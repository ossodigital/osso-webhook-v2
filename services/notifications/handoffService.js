import { randomUUID } from "node:crypto";
import { HANDOFF_STATUS } from "../../modules/handoff/handoffState.js";
import { notifyHuman } from "./humanNotification.js";

export async function executeHandoff({ lead, decision, commercialStage, summary, escalationMinutes = null } = {}, deps = {}) {
  if (!decision?.required) return { status: HANDOFF_STATUS.NONE, notificationConfirmed: false, notification: null };
  const repository = deps.findLatest && deps.record ? null : await import("../supabase/handoffRepository.js");
  const findLatest = deps.findLatest || repository.buscarHandoffAtivo;
  const record = deps.record || repository.registrarHandoffEvent;
  const notify = deps.notify || notifyHuman;
  const { data: latest, error } = await findLatest(lead.phone);
  if (error) return { status: HANDOFF_STATUS.NOTIFICATION_FAILED, notificationConfirmed: false, error: "HANDOFF_STATE_READ_FAILED" };

  if (latest?.status === HANDOFF_STATUS.NOTIFICATION_PENDING) {
    return { status: HANDOFF_STATUS.NOTIFICATION_PENDING, notificationConfirmed: false, deduplicated: true, handoffId: latest.handoff_id };
  }

  if (latest?.status === HANDOFF_STATUS.TAKEN_OVER) {
    return { status: HANDOFF_STATUS.TAKEN_OVER, notificationConfirmed: true, deduplicated: true, handoffId: latest.handoff_id };
  }

  if (latest?.status === HANDOFF_STATUS.NOTIFIED) {
    const ageMinutes = (Date.now() - new Date(latest.created_at).getTime()) / 60000;
    const escalationAllowed = decision.humanRequestEscalated && Number(escalationMinutes) > 0 && ageMinutes >= Number(escalationMinutes);
    if (!escalationAllowed) return { status: HANDOFF_STATUS.NOTIFIED, notificationConfirmed: true, deduplicated: true, handoffId: latest.handoff_id };
  }

  const continuingAttempt = [HANDOFF_STATUS.REQUIRED, HANDOFF_STATUS.NOTIFICATION_FAILED].includes(latest?.status);
  const handoffId = continuingAttempt ? latest.handoff_id : randomUUID();
  if (!continuingAttempt) {
    const requiredEvent = await record({ phone: lead.phone, handoff_id: handoffId, status: HANDOFF_STATUS.REQUIRED, reason: decision.reason, commercial_stage: commercialStage });
    if (requiredEvent?.error) return { status: HANDOFF_STATUS.NOTIFICATION_FAILED, notificationConfirmed: false, error: "HANDOFF_STATE_WRITE_FAILED" };
  }
  const pendingEvent = await record({ phone: lead.phone, handoff_id: handoffId, status: HANDOFF_STATUS.NOTIFICATION_PENDING, reason: decision.reason, commercial_stage: commercialStage });
  if (pendingEvent?.error) return { status: HANDOFF_STATUS.NOTIFICATION_FAILED, notificationConfirmed: false, error: "HANDOFF_STATE_WRITE_FAILED" };
  const notification = await notify({ lead, reason: decision.reason, handoffId, commercialStage, summary });
  const status = notification.success ? HANDOFF_STATUS.NOTIFIED : HANDOFF_STATUS.NOTIFICATION_FAILED;
  const saved = await record({ phone: lead.phone, handoff_id: handoffId, status, reason: decision.reason, commercial_stage: commercialStage, provider: notification.provider, notification_id: notification.notificationId, error_code: notification.error });
  if (saved?.error) return { status: HANDOFF_STATUS.NOTIFICATION_FAILED, notificationConfirmed: false, error: "HANDOFF_STATE_WRITE_FAILED", notification };
  return { status, notificationConfirmed: notification.success, deduplicated: false, handoffId, notification };
}
