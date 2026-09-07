import fetch from "node-fetch";
import FormData from "form-data";
import { env } from "../../config/env.js";
import { montarPromptSistema } from "./prompts.js";

export async function gerarRespostaAtendimento({
  leadName,
  conversationHistory,
  userContent,
  imageMode = false,
  decisionContext = null,
  fallbackReply = "Me conta melhor sua ideia 👊"
}) {
  let reply = fallbackReply;

  const maxTokens = imageMode ? 600 : 220;
  const temperature = imageMode ? 0.6 : 0.5;

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
              content: montarPromptSistema(leadName, { imageMode, decisionContext })
            },
            ...conversationHistory,
            {
              role: "user",
              content: userContent
            }
          ],
          temperature,
          max_tokens: maxTokens
        })
      }
    );

    const data = await aiResponse.json();
    console.log("AZURE CHAT RESULT:", imageMode ? "[IMAGE MODE]" : "[TEXT MODE]", data);

    if (!aiResponse.ok) {
      console.error("AZURE ERROR:", data);
    } else {
      reply = data?.choices?.[0]?.message?.content?.trim() || reply;
    }
  } catch (err) {
    console.error("ERRO AZURE FETCH:", err);
  }

  return reply;
}

export async function transcreverAudio(mediaId, preloadedMediaUrl = null) {
  let mediaUrl = preloadedMediaUrl;
  if (!mediaUrl) {
    const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
    });
    const mediaData = await mediaRes.json();
    console.log("WHATSAPP AUDIO MEDIA DATA:", mediaData);
    if (!mediaRes.ok || !mediaData?.url) {
      throw new Error(`Falha ao obter mídia do áudio: ${JSON.stringify(mediaData)}`);
    }
    mediaUrl = mediaData.url;
  }
  const audioRes = await fetch(mediaUrl, {
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
  let text = result?.text?.trim();
  if (!text) {
    // Whisper respondeu OK mas sem texto (audio silencioso, ruido, curto demais).
    // Antes isso virava um texto inventado ("quero fazer uma tatuagem"), fazendo o
    // agente responder como se o cliente tivesse dito algo que ele nao disse. Agora
    // isso conta como falha de transcricao de verdade, e quem chama (api/meta.js)
    // trata como erro: tenta de novo e, se continuar vazio, avisa o cliente para
    // escrever ou reenviar o audio, em vez de inventar uma resposta.
    throw new Error(`Transcrição vazia: ${JSON.stringify(result)}`);
  }
  if (text.length > 700) {
    text = text.slice(0, 700);
  }
  return text;
}
