import fetch from "node-fetch";
import { env } from "../config/env.js";
import detectarStage from "../modules/stages/stageDetector.js";
import {
  prepararConteudoImagemReferencia,
  prepararFallbackImagemReferencia
} from "../services/ai/media.js";
import { carregarHistoricoConversa } from "../services/ai/memory.js";
import { gerarRespostaAtendimento, transcreverAudio } from "../services/ai/openai.js";
import { sanitizarRespostaLinks } from "../services/ai/prompts.js";
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

  if (!dashboardToken) {
    return false;
  }

  return req.query.token === dashboardToken;
}

function getAdminPhones() {
  const phonesRaw = env.ADMIN_PHONES || env.ADMIN_PHONE || "";

  return phonesRaw
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean);
}

function extrairNome(userText = "") {
  const text = userText.trim();

  const match = text.match(/(?:meu nome é|me chamo|sou o|sou a|pode me chamar de|me chama de)\s+(.+)/i);
  if (match?.[1]) {
    return match[1].trim().split(/[,.!?]/)[0].trim();
  }

  const textoBaixo = text.toLowerCase();

  const palavrasInvalidas = [
    "oi",
    "olá",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "quero",
    "valor",
    "preço",
    "orcamento",
    "orçamento",
    "tattoo",
    "tatuagem",
    "agendar",
    "horário",
    "horario"
  ];

  if (palavrasInvalidas.includes(textoBaixo)) return null;

  if (text.length >= 2 && text.length <= 40 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(text)) {
    return text;
  }

  return null;
}

function extrairTextoBasicoMensagem(msg) {
  if (msg.text?.body) {
    return msg.text.body.trim();
  }

  if (msg.audio?.id) {
    return "áudio recebido durante atendimento humano";
  }

  if (msg.image?.id) {
    return "imagem recebida durante atendimento humano";
  }

  return "mensagem recebida durante atendimento humano";
}

async function alertarAdminLeadHumano({ leadName, phone, userText, stage }) {
  const adminPhones = getAdminPhones();

  if (!adminPhones.length) {
    console.warn("ADMIN_PHONES ou ADMIN_PHONE não configurado.");
    return [
      {
        ok: false,
        error: "ADMIN_PHONES ou ADMIN_PHONE não configurado"
      }
    ];
  }

  const mensagemAdmin = `🔥 LEAD PRONTO PRA FECHAR

Nome: ${leadName || "Sem nome"}
Telefone: ${phone}
Mensagem: ${userText}
Stage: ${stage}

Assuma esse atendimento manualmente.`;

  const results = [];

  for (const adminPhone of adminPhones) {
    const result = await enviarWhatsApp(adminPhone, mensagemAdmin);
    results.push({
      adminPhone,
      ...result
    });
  }

  return results;
}

export default async function handler(req, res) {
  try {
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

        const adminPhones = getAdminPhones();

        if (!adminPhones.length) {
          return res.status(500).json({
            ok: false,
            error: "ADMIN_PHONES ou ADMIN_PHONE não configurado"
          });
        }

        const results = [];

        for (const adminPhone of adminPhones) {
          const result = await enviarWhatsApp(
            adminPhone,
            `🧪 TESTE ADMIN OSSO ENGINE

Se você recebeu essa mensagem, o alerta admin está funcionando.

Horário: ${new Date().toISOString()}`
          );

          results.push({
            adminPhone,
            metaStatus: result.status,
            ok: result.ok,
            metaResponse: result.body
          });
        }

        return res.status(200).json({
          ok: true,
          adminPhones,
          results
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
          return res.status(403).json({
            ok: false,
            error: "Acesso negado"
          });
        }

        const phone = String(req.query.phone || "").trim();

        if (!phone) {
          return res.status(400).json({
            ok: false,
            error: "Telefone ausente"
          });
        }

        const { data, error } = await listarMensagensPorTelefone(phone, 200);

        if (error) {
          return res.status(500).json({
            ok: false,
            error: error.message
          });
        }

        return res.status(200).json({
          ok: true,
          phone,
          data
        });
      }

      if (req.query["hub.verify_token"] === env.VERIFY_TOKEN) {
        return res.status(200).send(req.query["hub.challenge"]);
      }

      return res.status(200).send("API META OK");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Método não permitido");
    }

    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.status(200).send("ok");

    const phone = msg.from;

    const { data: existingLead, error: existingLeadError } = await buscarLeadPorTelefone(phone);

    if (existingLeadError) {
      console.error("SUPABASE EXISTING LEAD ERROR:", existingLeadError);
    }

    if (existingLead?.stage === "humano") {
      const humanUserText = extrairTextoBasicoMensagem(msg);

      await inserirMensagem({
        phone,
        role: "user",
        content: humanUserText
      });

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

    if (
      existingLead &&
      ["followup_1", "followup_2", "encerrado"].includes(existingLead.stage)
    ) {
      leadPayload.followup_count = 0;
      leadPayload.last_followup_at = null;
    }

    const { error: leadError } = await upsertLead(leadPayload);

    if (leadError) console.error("SUPABASE LEAD ERROR:", leadError);

    const { error: userMsgError } = await inserirMensagem({ phone, role: "user", content: userText });

    if (userMsgError) console.error("SUPABASE USER MSG ERROR:", userMsgError);

    if (!leadName) {
      const nameReply = "Claro! Antes de continuar, como posso te chamar? 😊";

      const { error: assistantNameMsgError } = await inserirMensagem({
        phone,
        role: "assistant",
        content: nameReply
      });

      if (assistantNameMsgError) {
        console.error("SUPABASE ASSISTANT NAME MSG ERROR:", assistantNameMsgError);
      }

      await enviarWhatsApp(phone, nameReply);

      return res.status(200).send("ok");
    }

    const { historyError, conversationHistory } = await carregarHistoricoConversa(phone, 4);

    if (historyError) console.error("SUPABASE HISTORY ERROR:", historyError);

    let reply = await gerarRespostaAtendimento({
      leadName,
      conversationHistory,
      userContent
    });

    reply = sanitizarRespostaLinks(reply);

    const newStage = detectarStage(userText, stage);

    if (newStage === "humano") {
      reply = `Perfeito, ${leadName}! 🙌

Vou encaminhar seu atendimento direto pro Coringa finalizar certinho com você.`;
    }

    const updatePayload = {
      name: leadName,
      stage: newStage,
      updated_at: new Date().toISOString(),
      last_message: userText
    };

    if (
      existingLead &&
      ["followup_1", "followup_2", "encerrado"].includes(existingLead.stage)
    ) {
      updatePayload.followup_count = 0;
      updatePayload.last_followup_at = null;
    }

    const { error: updateLeadError } = await atualizarLeadPorTelefone(phone, updatePayload);

    if (updateLeadError) {
      console.error("SUPABASE UPDATE LEAD ERROR:", updateLeadError);
    }

    if (newStage === "humano" && existingLead?.stage !== "humano") {
      await alertarAdminLeadHumano({
        leadName,
        phone,
        userText,
        stage: newStage
      });
    }

    const { error: assistantMsgError } = await inserirMensagem({
      phone,
      role: "assistant",
      content: reply
    });

    if (assistantMsgError) {
      console.error("SUPABASE ASSISTANT MSG ERROR:", assistantMsgError);
    }

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

