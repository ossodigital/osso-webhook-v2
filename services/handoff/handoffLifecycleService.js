import { HANDOFF_STATUS, transitionHandoff } from "../../modules/handoff/handoffState.js";

export async function transitionActiveHandoff({ phone, nextStatus, reason } = {}, deps = {}) {
  const repository = deps.findLatest && deps.record ? null : await import("../supabase/handoffRepository.js");
  const findLatest = deps.findLatest || repository.buscarHandoffAtivo;
  const record = deps.record || repository.registrarHandoffEvent;
  const { data: latest, error } = await findLatest(phone);
  if (error) return { ok: false, error: "HANDOFF_STATE_READ_FAILED" };
  if (!latest) return { ok: false, error: "HANDOFF_NOT_FOUND" };
  if (latest.status === nextStatus) return { ok: true, event: latest, deduplicated: true };
  try {
    transitionHandoff(latest.status, nextStatus);
  } catch {
    return { ok: false, error: "INVALID_HANDOFF_TRANSITION", currentStatus: latest.status };
  }
  const { data, error: writeError } = await record({
    phone,
    handoff_id: latest.handoff_id,
    status: nextStatus,
    reason: reason || latest.reason,
    commercial_stage: latest.commercial_stage
  });
  if (writeError) return { ok: false, error: "HANDOFF_STATE_WRITE_FAILED" };
  return { ok: true, event: data, deduplicated: false };
}

export async function resolveNotifiedHandoff(phone, deps) {
  return transitionActiveHandoff({ phone, nextStatus: HANDOFF_STATUS.RESOLVED, reason: "CUSTOMER_CANCELLED_HANDOFF" }, deps);
}

export async function takeoverHandoff(phone, deps) {
  return transitionActiveHandoff({ phone, nextStatus: HANDOFF_STATUS.TAKEN_OVER, reason: "DASHBOARD_TAKEOVER" }, deps);
}

export async function releaseHandoffToAi(phone, deps) {
  return transitionActiveHandoff({ phone, nextStatus: HANDOFF_STATUS.RESOLVED, reason: "DASHBOARD_RELEASE_AI" }, deps);
}
