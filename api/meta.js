import fetch from "node-fetch";
import { env } from "../config/env.js";
import { extrairTextoBasicoMensagem } from "../modules/handoff/handoffRules.js";
import { extrairNome } from "../modules/qualification/qualificationRules.js";
import detectarStage from "../modules/stages/stageDetector.js";
import {
  prepararConteudoImagemReferencia,
  prepararFallbackImagemReferencia
} from "../services/ai/media.js";
import { carregarHistoricoConversa } from "../services/ai/memory.js";
import { gerarRespostaAtendimento, transcreverAudio } from "../services/ai/openai.js";
import { sanitizarRespostaLinks } from "../services/ai/prompts.js";
import {
  alertarAdminLeadHumano,
  getAdminPhones,
  testarAdminAlerts
} from "../services/meta/adminAlerts.js";
import { enviarWhatsApp } from "../services/meta/whatsapp.js";
import {
  atualizarLeadPorTelefone,
  buscarLeadPorTelefone,
  listarLeadsRecentes,
  upsertLead
} from "../services/supabase/leadsRepository.js";
import {
  inserirMensagem,
  listarMensagensPorTelefone,
  listarMensagensRecentes
} from "../services/supabase/messagesRepository.js";

function validarDashboardToken(req) {
  const dashboardToken = env.DASHBOARD_TOKEN;
  if (!dashboardToken) return false;
  return req.query.token === dashboardToken;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ─── GET ────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      if (req.query.debug === "ping") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }
        return res.status(200).json({
          ok: true,
          route: "api/meta",
          verifyTokenExists: !!env.VERIFY_TOKEN,
          whatsappTokenExists: !!env.WHATSAPP_TOKEN,
          phoneNumberIdExists: !!env.PHONE_NUMBER_ID,
          azureEndpointExists: !!env.AZURE_ENDPOINT,
          azureApiKeyExists: !!env.AZURE_API_KEY,
          azureDeploymentExists: !!env.AZURE_DEPLOYMENT,
          azureWhisperDeploymentExists: !!env.AZURE_WHISPER_DEPLOYMENT,
          azureAudioApiVersionExists: !!env.AZURE_AUDIO_API_VERSION,
          supabaseUrlExists: !!env.SUPABASE_URL,
          supabaseKeyExists: !!env.SUPABASE_KEY,
          dashboardTokenExists: !!env.DASHBOARD_TOKEN,
          adminPhoneExists: !!env.ADMIN_PHONE,
          adminPhonesExists: !!env.ADMIN_PHONES,
          adminPhones: getAdminPhones()
        });
      }

      if (req.query.debug === "admin-test") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }
        const adminTest = await testarAdminAlerts();
        return res.status(adminTest.status).json(adminTest.body);
      }

      if (req.query.debug === "admin-test-single") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }
        const phone = String(req.query.phone || "").trim().replace(/\D/g, "");
        if (!phone) {
          return res.status(400).json({ ok: false, error: "Telefone ausente" });
        }
        const result = await enviarWhatsApp(
          phone,
          `TESTE ADMIN SINGLE OSSO ENGINE\n\nSe voce recebeu essa mensagem, o envio individual esta funcionando.\n\nHorario: ${new Date().toISOString()}`
        );
        return res.status(200).json({
          ok: result.ok,
          phone,
          metaStatus: result.status,
          wa_id: result.wa_id,
          message_id: result.message_id,
          metaResponseRaw: result.body
        });
      }

      if (req.query.debug === "leads") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }
        const { data, error } = await listarLeadsRecentes(50);
        if (error) return res.status(500).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, data });
      }

      if (req.query.debug === "messages") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }
        const { data, error } = await listarMensagensRecentes(80);
        if (error) return res.status(500).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, data });
      }

      if (req.query.debug === "messages-by-phone") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }
        const phone = String(req.query.phone || "").trim();
        if (!phone) {
          return res.status(400).json({ ok: false, error: "Telefone ausente" });
        }
        const { data, error } = await listarMensagensPorTelefone(phone, 200);
        if (error) {
          return res.status(500).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true, phone, data });
      }

      if (req.query["hub.verify_token"] === env.VERIFY_TOKEN) {
        return res.status(200).send(req.query["hub.challenge"]);
      }

      return res.status(200).send("API META OK");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Método não permitido");
    }

    // ─── POST DASHBOARD (send-message, takeover, release-ai) ────────────────
    if (["send-message", "takeover", "release-ai"].includes(req.query.debug)) {
      const dashboardAction = req.query.debug;
      let dashboardBody = req.body || {};

      if (Buffer.isBuffer(dashboardBody)) {
        dashboardBody = dashboardBody.toString("utf8");
      }
      if (typeof dashboardBody === "string") {
        try {
          dashboardBody = JSON.parse(dashboardBody || "{}");
        } catch (err) {
          console.error("DASHBOARD BODY JSON ERROR:", dashboardAction, err);
          return res.status(400).json({ ok: false, error: "Body JSON inválido" });
        }
      }

      const dashboardToken = env.DASHBOARD_TOKEN;
      if (!dashboardToken || dashboardBody?.token !== dashboardToken) {
        console.error("DASHBOARD TOKEN ERROR:", dashboardAction);
        return res.status(403).json({ ok: false, error: "Acesso negado" });
      }

      const phone = String(dashboardBody?.phone || "").trim();
      if (!phone) {
        console.error("DASHBOARD PHONE ERROR:", dashboardAction);
        return res.status(400).json({ ok: false, error: "Telefone ausente" });
      }

      // send-message
      if (dashboardAction === "send-message") {
        const message = String(dashboardBody?.message || "").trim();
        if (!message) {
          return res.status(400).json({ ok: false, error: "Mensagem ausente" });
        }

        const whatsappResult = await enviarWhatsApp(phone, message);
        if (!whatsappResult.ok) {
          return res.status(500).json({ ok: false, error: "Erro ao enviar mensagem no WhatsApp" });
        }

        await inserirMensagem({ phone, role: "assistant", content: message });
        await atualizarLeadPorTelefone(phone, {
          last_message: message,
          updated_at: new Date().toISOString()
        });

        return res.status(200).json({ ok: true });
      }

      // release-ai
      if (dashboardAction === "release-ai") {
        const { error: releaseAiError } = await atualizarLeadPorTelefone(phone, {
          stage: "novo",
          updated_at: new Date().toISOString()
        });

        if (releaseAiError) {
          console.error("DASHBOARD RELEASE-AI ERROR:", { phone, error: releaseAiError });
          return res.status(500).json({ ok: false, error: releaseAiError.message });
        }

        return res.status(200).json({ ok: true, action: "release-ai", phone, stage: "novo" });
      }

      // takeover
      if (dashboardAction === "takeover") {
        const { error: leadError } = await atualizarLeadPorTelefone(phone, {
          stage: "humano",
          updated_at: new Date().toISOString()
        });

        if (leadError) {
          console.error("SUPABASE DASHBOARD STAGE ERROR:", leadError);
          return res.status(500).json({ ok: false, error: leadError.message });
        }

        const { data: dashboardLead } = await buscarLeadPorTelefone(phone);

        // ✅ ALERTA ADMIN — reimplementado
        const adminResults = await alertarAdminLeadHumano({
          leadName: dashboardLead?.name,
          phone,
          userText: dashboardLead?.last_message || "Atendimento assumido pelo dashboard",
          stage: "humano"
        });

        console.log("DASHBOARD TAKEOVER ADMIN ALERT:", adminResults);

        const adminErrors = adminResults.filter((r) => !r.ok);
        if (adminErrors.length) {
          console.error("DASHBOARD ADMIN ALERT ERROR:", adminErrors);
        }

        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: "Ação inválida" });
    }

    // ─── POST WHATSAPP WEBHOOK ───────────────────────────────────────────────
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.status(200).send("ok");

    const phone = msg.from;

    const { data: existingLead, error: existingLeadError } = await buscarLeadPorTelefone(phone);
    if (existingLeadError) {
      console.error("SUPABASE EXISTING LEAD ERROR:", existingLeadError);
    }

    if (existingLead?.stage === "humano") {
      const humanUserText = extrairTextoBasicoMensagem(msg);
      await inserirMensagem({ phone, role: "user", content: humanUserText });
      await atualizarLeadPorTelefone(phone, {
        last_message: humanUserText,
        updated_at: new Date().toISOString()
      });
      console.log("ATENDIMENTO HUMANO ATIVO — IA BLOQUEADA:", phone);
      return res.status(200).send("handoff_humano");
    }

    let userText = "mensagem";
    let userContent = [{ type: "text", text: "mensagem" }];

    if (msg.text?.body) {
      userText = msg.text.body.trim();
      userContent = [{ type: "text", text: userText }];
    } else if (msg.audio?.id) {
      try {
        userText = await transcreverAudio(msg.audio.id);
        userContent = [{ type: "text", text: userText }];
      } catch (err) {
        console.error("ERRO TRANSCRIÇÃO:", err);
        userText = "quero fazer uma tatuagem";
        userContent = [{ type: "text", text: userText }];
      }
    } else if (msg.image?.id) {
      try {
        const mediaUrl = await getMediaUrl(msg.image.id);
        const buffer = await downloadMedia(mediaUrl);
        const imageContent = prepararConteudoImagemReferencia(buffer);
        userText = imageContent.userText;
        userContent = imageContent.userContent;
      } catch (err) {
        console.error("ERRO IMAGEM:", err);
        const imageFallback = prepararFallbackImagemReferencia();
        userText = imageFallback.userText;
        userContent = imageFallback.userContent;
      }
    }

    let leadName = existingLead?.name || null;
    let stage = detectarStage(userText, existingLead?.stage);

    if (!leadName && existingLead?.stage === "captando_nome") {
      const nomeCapturado = extrairNome(userText);
      if (nomeCapturado) {
        leadName = nomeCapturado;
        stage = detectarStage(userText, "novo");
      }
    }

    const leadPayload = {
      phone,
      name: leadName,
      last_message: userText,
      stage,
      updated_at: new Date().toISOString()
    };

    if (!leadName) {
      leadPayload.stage = "captando_nome";
    }

    if (existingLead && ["followup_1", "followup_2", "encerrado"].includes(existingLead.stage)) {
      leadPayload.followup_count = 0;
      leadPayload.last_followup_at = null;
    }

    const { error: leadError } = await upsertLead(leadPayload);
    if (leadError) console.error("SUPABASE LEAD ERROR:", leadError);

    const { error: userMsgError } = await inserirMensagem({ phone, role: "user", content: userText });
    if (userMsgError) console.error("SUPABASE USER MSG ERROR:", userMsgError);

    if (!leadName) {
      const nameReply = "Claro! Antes de continuar, como posso te chamar? 😊";
      await inserirMensagem({ phone, role: "assistant", content: nameReply });
      await enviarWhatsApp(phone, nameReply);
      return res.status(200).send("ok");
    }

    const { historyError, conversationHistory } = await carregarHistoricoConversa(phone, 4);
    if (historyError) console.error("SUPABASE HISTORY ERROR:", historyError);

    let reply = await gerarRespostaAtendimento({ leadName, conversationHistory, userContent });
    reply = sanitizarRespostaLinks(reply);

    const newStage = detectarStage(userText, stage);

    if (newStage === "humano") {
      reply = `Perfeito, ${leadName}! 🙌\n\nVou encaminhar seu atendimento direto pro Coringa finalizar certinho com você.`;
    }

    const updatePayload = {
      name: leadName,
      stage: newStage,
      updated_at: new Date().toISOString(),
      last_message: userText
    };

    if (existingLead && ["followup_1", "followup_2", "encerrado"].includes(existingLead.stage)) {
      updatePayload.followup_count = 0;
      updatePayload.last_followup_at = null;
    }

    const { error: updateLeadError } = await atualizarLeadPorTelefone(phone, updatePayload);
    if (updateLeadError) {
      console.error("SUPABASE UPDATE LEAD ERROR:", updateLeadError);
    }

    if (newStage === "humano" && existingLead?.stage !== "humano") {
      await alertarAdminLeadHumano({ leadName, phone, userText, stage: newStage });
    }

    await inserirMensagem({ phone, role: "assistant", content: reply });
    await enviarWhatsApp(phone, reply);

    return res.status(200).send("ok");
  } catch (err) {
    console.error("ERRO GERAL META:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function getMediaUrl(mediaId) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
  });
  const data = await res.json();
  console.log("WHATSAPP MEDIA DATA:", data);
  if (!res.ok || !data?.url) {
    throw new Error(`Falha ao obter URL da mídia: ${JSON.stringify(data)}`);
  }
  return data.url;
}

async function downloadMedia(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
  });
  if (!res.ok) throw new Error("Falha ao baixar mídia");
  return await res.arrayBuffer();
}