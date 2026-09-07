import fetch from "node-fetch";

/**
 * Envia uma mensagem de TEMPLATE do WhatsApp (categoria "Utilidade"),
 * diferente da mensagem de texto livre usada em enviarWhatsApp().
 *
 * Por que existe: mensagem de texto livre só é entregue pelo WhatsApp se o
 * destinatário tiver falado com o número oficial nas últimas 24h (janela de
 * atendimento). Template ignora essa regra e é entregue sempre — por isso é
 * usado aqui como um FALLBACK do alerta admin, sem substituir o mecanismo
 * original (enviarWhatsApp / alertarAdminLeadHumano continuam intactos).
 *
 * Pré-requisito único, feito uma vez fora do código: criar o template
 * "alerta_atendimento_humano" (categoria Utilidade, idioma pt_BR, 1 variável
 * de corpo) e ter ele aprovado no WhatsApp Manager (Meta Business).
 */
export async function enviarWhatsAppTemplate(phone, corpoVariavel) {
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
        type: "template",
        template: {
          name: "alerta_atendimento_humano",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: corpoVariavel }]
            }
          ]
        }
      })
    }
  );

  const responseText = await sendResponse.text();

  if (!sendResponse.ok) {
    console.error("WHATSAPP TEMPLATE SEND ERROR:", responseText);
  }

  return {
    ok: sendResponse.ok,
    status: sendResponse.status,
    body: responseText
  };
}

/**
 * Fallback do alerta admin: usado só quando alertarAdminLeadHumano()
 * (texto livre) falhou pra algum número. Manda o mesmo aviso, via template,
 * pra lista de admins já configurada em ADMIN_PHONES / ADMIN_PHONE.
 */
export async function alertarAdminViaTemplate({ adminPhones, leadName, phone, userText, stage }) {
  if (!adminPhones?.length) {
    return [{ ok: false, error: "ADMIN_PHONES ou ADMIN_PHONE não configurado" }];
  }

  const corpoVariavel = `${leadName || "Sem nome"} (${phone}) — stage: ${stage} — "${String(userText || "").slice(0, 200)}"`;

  const results = [];
  for (const adminPhone of adminPhones) {
    const result = await enviarWhatsAppTemplate(adminPhone, corpoVariavel);
    results.push({ adminPhone, ...result });
  }
  return results;
}
