// Validação server-side das mensagens humanas enviadas pelo dashboard.
// O dashboard já bloqueia estes casos; aqui é a segunda barreira, porque uma
// mensagem que chega ao WhatsApp não pode ser apagada pela Meta Cloud API.

export const MANUAL_MESSAGE_SHORT_LIMIT = 3;
export const MANUAL_MESSAGE_DUPLICATE_WINDOW_MS = 30 * 1000;

export function validateManualMessage({ message = "", confirmShort = false, allowDuplicate = false, lastAssistant = null, now = Date.now() } = {}) {
  const text = String(message || "").trim();
  if (!text) return { ok: false, status: 400, error: "Mensagem ausente" };

  if (text.length <= MANUAL_MESSAGE_SHORT_LIMIT && confirmShort !== true) {
    return { ok: false, status: 422, error: "Mensagem muito curta. Confirme o envio no dashboard.", code: "SHORT_MESSAGE_NEEDS_CONFIRMATION" };
  }

  if (allowDuplicate !== true && lastAssistant?.content && lastAssistant.content.trim() === text) {
    const sentAt = new Date(lastAssistant.created_at).getTime();
    if (Number.isFinite(sentAt) && now - sentAt >= 0 && now - sentAt < MANUAL_MESSAGE_DUPLICATE_WINDOW_MS) {
      return { ok: true, duplicate: true, text };
    }
  }

  return { ok: true, duplicate: false, text };
}
