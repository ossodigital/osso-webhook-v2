import fetch from "node-fetch";
import FormData from "form-data";

// Provedor: WhatsApp Business Platform – Cloud API oficial da Meta
// (graph.facebook.com/{PHONE_NUMBER_ID}/messages). A Cloud API não possui
// endpoint para apagar/revogar ("apagar para todos") uma mensagem já enviada
// pelo negócio; ela só *recebe* o webhook de revoke feito pelo cliente.
// Por isso o dashboard não oferece "Apagar para todos": toda correção é
// feita antes do envio (composer com revisão).
export const WHATSAPP_PROVIDER_CAPABILITIES = Object.freeze({
  provider: "META_CLOUD_API",
  deleteSentMessage: false,
  editSentMessage: false
});

export async function enviarWhatsApp(phone, body) {
  const sendResponse = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        text: { body }
      })
    }
  );

  const responseText = await sendResponse.text();

  if (!sendResponse.ok) {
    console.error("WHATSAPP SEND ERROR:", responseText);
  }

  return {
    ok: sendResponse.ok,
    status: sendResponse.status,
    body: responseText
  };
}

/**
 * Sobe um arquivo de mídia (ex: áudio já convertido pra ogg/opus) pro
 * WhatsApp e devolve o media id, usado depois em enviarWhatsAppAudio.
 */
export async function uploadWhatsAppMedia(buffer, mimeType, filename) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buffer, { filename, contentType: mimeType });

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    }
  );

  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(`Falha ao subir mídia no WhatsApp: ${JSON.stringify(data)}`);
  }
  return data.id;
}

/**
 * Envia uma mensagem de áudio (nota de voz) pro cliente, referenciando um
 * media id já enviado via uploadWhatsAppMedia.
 */
export async function enviarWhatsAppAudio(phone, mediaId) {
  const sendResponse = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "audio",
        audio: { id: mediaId }
      })
    }
  );

  const responseText = await sendResponse.text();

  if (!sendResponse.ok) {
    console.error("WHATSAPP SEND AUDIO ERROR:", responseText);
  }

  return {
    ok: sendResponse.ok,
    status: sendResponse.status,
    body: responseText
  };
}
