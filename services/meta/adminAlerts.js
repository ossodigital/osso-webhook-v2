import { env } from "../../config/env.js";
import { enviarWhatsApp } from "./whatsapp.js";

export function getAdminPhones() {
  const phonesRaw = env.ADMIN_PHONES || env.ADMIN_PHONE || "";

  return phonesRaw
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean);
}

export async function alertarAdminLeadHumano({ leadName, phone, userText, stage, reason = null, handoffId = null }) {
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
Motivo: ${reason || "solicitação de atendimento humano"}
Handoff: ${handoffId || "legado"}

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

export async function testarAdminAlerts() {
  const adminPhones = getAdminPhones();

  if (!adminPhones.length) {
    return {
      status: 500,
      body: {
        ok: false,
        error: "ADMIN_PHONES ou ADMIN_PHONE não configurado"
      }
    };
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

  return {
    status: 200,
    body: {
      ok: true,
      adminPhones,
      results
    }
  };
}
