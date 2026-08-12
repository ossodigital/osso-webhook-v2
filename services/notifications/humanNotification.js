import { alertarAdminLeadHumano } from "../meta/adminAlerts.js";

function notificationId(result) {
  try { return JSON.parse(result?.body || "{}").messages?.[0]?.id || null; } catch { return null; }
}

export async function notifyHuman({ lead, reason, handoffId, commercialStage, summary } = {}, { alert = alertarAdminLeadHumano } = {}) {
  const timestamp = new Date().toISOString();
  try {
    const results = await alert({
      leadName: lead?.name,
      phone: lead?.phone,
      userText: summary,
      stage: commercialStage,
      reason,
      handoffId
    });
    const successful = (results || []).filter((item) => item?.ok === true);
    if (!successful.length) return { success: false, provider: "WHATSAPP_META", notificationId: null, timestamp, error: "ADMIN_NOTIFICATION_FAILED", handoffId };
    return { success: true, provider: "WHATSAPP_META", notificationId: notificationId(successful[0]), timestamp, error: null, handoffId };
  } catch (error) {
    return { success: false, provider: "WHATSAPP_META", notificationId: null, timestamp, error: error?.name || "NotificationError", handoffId };
  }
}
