// Executa o handoff humano de verdade (estado persistido + alerta ao admin).
// O resultado `ok` é o que autoriza a resposta a dizer que o pedido foi
// registrado — nunca o contrário.

import { HANDOFF_STATUS } from "../../modules/handoff/handoffState.js";
import { buildOperationalSummary } from "../../modules/attendance/operationalSummary.js";

async function defaultDeps() {
  const [{ atualizarLeadPorTelefone }, { alertarAdminLeadHumano }, { executeHandoff }] = await Promise.all([
    import("../supabase/leadsRepository.js"),
    import("../meta/adminAlerts.js"),
    import("../notifications/handoffService.js")
  ]);
  return { updateLead: atualizarLeadPorTelefone, alertAdmin: alertarAdminLeadHumano, executeHandoff };
}

export async function executarHandoffAtendimento({
  phone,
  leadName,
  pilotEnabled = false,
  state,
  reason,
  commercialStage = null,
  escalationMinutes = null
} = {}, deps = null) {
  const { updateLead, alertAdmin, executeHandoff } = deps || await defaultDeps();
  const summary = buildOperationalSummary(state)?.text || reason;

  if (pilotEnabled) {
    // Piloto: handoff_events é a fonte de verdade de ownership (NOTIFIED bloqueia a IA).
    const handoff = await executeHandoff({
      lead: { phone, name: leadName },
      decision: { required: true, reason },
      commercialStage,
      summary,
      escalationMinutes
    });
    const ok = [HANDOFF_STATUS.NOTIFIED, HANDOFF_STATUS.TAKEN_OVER, HANDOFF_STATUS.NOTIFICATION_PENDING].includes(handoff?.status);
    return { ok, mode: "PILOT", handoff, stage: null, summary };
  }

  // Legado: stage "humano" bloqueia a IA nas próximas mensagens e aparece no dashboard.
  const { error } = await updateLead(phone, { stage: "humano", updated_at: new Date().toISOString() }) || {};
  if (error) {
    console.error("ATTENDANCE HANDOFF STAGE ERROR:", error?.message || error);
    return { ok: false, mode: "LEGACY", stage: null, summary, error: "HANDOFF_STATE_WRITE_FAILED" };
  }

  let alertResults = [];
  try {
    alertResults = await alertAdmin({ leadName, phone, userText: summary, stage: "humano", reason }) || [];
  } catch (err) {
    alertResults = [{ ok: false, error: err?.name || "AlertError" }];
  }
  const alertOk = alertResults.some((item) => item?.ok === true);
  if (!alertOk) console.error("ATTENDANCE HANDOFF ADMIN ALERT ERROR:", alertResults.map((item) => item?.error || item?.status));

  return { ok: true, mode: "LEGACY", stage: "humano", summary, alertOk };
}
