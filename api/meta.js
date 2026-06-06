import fetch from "node-fetch";
import FormData from "form-data";
import { env } from "../config/env.js";
import detectarStage from "../modules/stages/stageDetector.js";
import { enviarWhatsApp } from "../services/meta/whatsapp.js";
import { supabase } from "../services/supabase/client.js";

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

        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) return res.status(500).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, data });
      }

      if (req.query.debug === "messages") {
        if (!validarDashboardToken(req)) {
          return res.status(403).json({ ok: false, error: "Acesso negado" });
        }

        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(80);

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

        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("phone", phone)
          .order("created_at", { ascending: true })
          .limit(200);

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

    const { data: existingLead, error: existingLeadError } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (existingLeadError) {
      console.error("SUPABASE EXISTING LEAD ERROR:", existingLeadError);
    }

    if (existingLead?.stage === "humano") {
      const humanUserText = extrairTextoBasicoMensagem(msg);

      await supabase
        .from("messages")
        .insert({
          phone,
          role: "user",
          content: humanUserText
        });

      await supabase
        .from("leads")
        .update({
          last_message: humanUserText,
          updated_at: new Date().toISOString()
        })
        .eq("phone", phone);

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
        const base64 = Buffer.from(buffer).toString("base64");

        userText = "cliente enviou imagem de referência de tattoo";

        userContent = [
          {
            type: "text",
            text: `O cliente enviou uma referência de tatuagem.

Analise a imagem e:
- identifique o estilo
- sugira tamanho ideal
- sugira possíveis locais do corpo
- peça apenas o que faltar para orçamento
- identifique o que o cliente já informou
- não repita perguntas
- seja direto, humano e profissional`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64}`
            }
          }
        ];
      } catch (err) {
        console.error("ERRO IMAGEM:", err);
        userText = "cliente enviou imagem de tattoo";
        userContent = [
          {
            type: "text",
            text: `Cliente enviou uma imagem de referência de tatuagem.

Ajude no atendimento:
- diga que recebeu a referência
- peça tamanho em cm se faltar
- peça local do corpo se faltar
- conduza para orçamento sem repetir perguntas`
          }
        ];
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

    const { error: leadError } = await supabase
      .from("leads")
      .upsert(leadPayload, { onConflict: "phone" });

    if (leadError) console.error("SUPABASE LEAD ERROR:", leadError);

    const { error: userMsgError } = await supabase
      .from("messages")
      .insert({ phone, role: "user", content: userText });

    if (userMsgError) console.error("SUPABASE USER MSG ERROR:", userMsgError);

    if (!leadName) {
      const nameReply = "Claro! Antes de continuar, como posso te chamar? 😊";

      const { error: assistantNameMsgError } = await supabase
        .from("messages")
        .insert({ phone, role: "assistant", content: nameReply });

      if (assistantNameMsgError) {
        console.error("SUPABASE ASSISTANT NAME MSG ERROR:", assistantNameMsgError);
      }

      await enviarWhatsApp(phone, nameReply);

      return res.status(200).send("ok");
    }

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(4);

    if (historyError) console.error("SUPABASE HISTORY ERROR:", historyError);

    const conversationHistory = (history || [])
      .reverse()
      .map((item) => ({
        role: item.role,
        content: item.content
      }));

    let reply = "Me conta melhor sua ideia 👍";

    try {
      const aiResponse = await fetch(
        `${env.AZURE_ENDPOINT}/openai/deployments/${env.AZURE_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`,
        {
          method: "POST",
          headers: {
            "api-key": env.AZURE_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content: `Você é o atendimento oficial do Tattoo Até os Ossos.

Nome do cliente: ${leadName}

Regras principais:
- fale como humano, direto e profissional
- nunca diga que é IA
- nunca envie links
- nunca erre os instagrams
- use o histórico da conversa para não repetir perguntas
- identifique o que o cliente já informou
- conduza para orçamento e agendamento com naturalidade
- não force agendamento antes de entender tamanho, local e ideia
- se o cliente parecer curioso, responda curto e conduza com uma pergunta útil
- responda sempre em até 3 linhas, salvo quando o cliente pedir explicação detalhada
- faça no máximo 1 pergunta por resposta
- não escreva textos longos
- use o nome do cliente naturalmente, mas não em toda mensagem
- se o cliente demonstrar intenção clara de fechar, pagar sinal, reservar horário ou pedir atendimento humano, avise que vai encaminhar para o Coringa finalizar

Captação obrigatória:
- O nome do cliente já foi capturado no sistema.
- Nunca peça o nome novamente.
- Prioridade do atendimento: ideia da tattoo → tamanho em cm → local do corpo → referência → orçamento/agendamento.

Handoff humano:
- Quando o cliente estiver pronto para fechar, pagar sinal, reservar horário ou pedir humano, responda curto informando que o atendimento será encaminhado ao Coringa.
- Não continue tentando vender depois do handoff.
- Não diga que é robô ou IA.

Instagram:
Coringa: @coringatattoosp
Jennyfer: @jennyfertattoopierce
Estúdio: @tattooateosossos

Se o cliente pedir instagram, trabalhos ou portfólio, responda exatamente:
Coringa: @coringatattoosp
Jennyfer: @jennyfertattoopierce
Estúdio: @tattooateosossos

Orçamento:
- pedir tamanho em cm, local do corpo e ideia/referência quando faltar
- não passar preço seco sem contexto
- pequenas: a partir de R$150
- sessão mínima para projetos grandes: R$650

Agendamento:
- horários padrão: 10h / 14h / 17h
- sinal: R$100
- o sinal é descontado no valor final`
              },
              ...conversationHistory,
              {
                role: "user",
                content: userContent
              }
            ],
            temperature: 0.5,
            max_tokens: 220
          })
        }
      );

      const data = await aiResponse.json();
      console.log("AZURE CHAT RESULT:", data);

      if (!aiResponse.ok) {
        console.error("AZURE ERROR:", data);
      } else {
        reply = data?.choices?.[0]?.message?.content?.trim() || reply;
      }
    } catch (err) {
      console.error("ERRO AZURE FETCH:", err);
    }

    if (/http|instagram\.com/i.test(reply)) {
      reply = `Coringa: @coringatattoosp
Jennyfer: @jennyfertattoopierce
Estúdio: @tattooateosossos`;
    }

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

    const { error: updateLeadError } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("phone", phone);

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

    const { error: assistantMsgError } = await supabase
      .from("messages")
      .insert({ phone, role: "assistant", content: reply });

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

async function transcreverAudio(mediaId) {
  const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
  });

  const mediaData = await mediaRes.json();
  console.log("WHATSAPP AUDIO MEDIA DATA:", mediaData);

  if (!mediaRes.ok || !mediaData?.url) {
    throw new Error(`Falha ao obter mídia do áudio: ${JSON.stringify(mediaData)}`);
  }

  const audioRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
  });

  if (!audioRes.ok) throw new Error("Falha ao baixar áudio");

  const buffer = await audioRes.arrayBuffer();
  console.log("AUDIO BUFFER SIZE:", buffer.byteLength);

  const form = new FormData();

  form.append("file", Buffer.from(buffer), {
    filename: "audio.ogg",
    contentType: "audio/ogg"
  });

  form.append("model", env.AZURE_WHISPER_DEPLOYMENT);

  const audioDeployment = env.AZURE_WHISPER_DEPLOYMENT;
  const apiVersion = env.AZURE_AUDIO_API_VERSION || "2025-04-01-preview";

  const transcriptionRes = await fetch(
    `${env.AZURE_ENDPOINT}/openai/deployments/${audioDeployment}/audio/transcriptions?api-version=${apiVersion}`,
    {
      method: "POST",
      headers: {
        "api-key": env.AZURE_API_KEY,
        ...form.getHeaders()
      },
      body: form
    }
  );

  const result = await transcriptionRes.json();
  console.log("TRANSCRIÇÃO RESULT:", result);

  if (!transcriptionRes.ok) {
    throw new Error(`Transcription error: ${JSON.stringify(result)}`);
  }

  let text = result?.text?.trim() || "quero fazer uma tatuagem";

  if (text.length > 700) {
    text = text.slice(0, 700);
  }

  return text;
}
