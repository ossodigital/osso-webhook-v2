import fetch from "node-fetch";

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
