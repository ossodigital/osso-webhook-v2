const FALSE_PROMISE = /\b(j[aá]\s+)?(avisei|chamei|chamamos|encaminhei|encaminhamos|reforcei|passei)\b|\b(ele|coringa)\s+j[aá]\s+est[aá]\s+ciente\b|\b(ele|coringa)\s+vai\s+entrar\s+em\s+contato\b/iu;

export function guardHandoffReply({ reply = "", handoff = null, leadName = null } = {}) {
  if (!handoff || handoff.status === "NONE") return reply;
  const name = leadName ? `, ${leadName}` : "";
  if (handoff.notificationConfirmed === true) return "Pronto, já avisei o Coringa por aqui.";
  if (handoff.status === "NOTIFICATION_FAILED") return `Entendi que você quer falar diretamente com o Coringa${name}. Registrei a solicitação, mas o alerta não foi confirmado. Não vou afirmar que ele foi avisado.`;
  if (FALSE_PROMISE.test(reply) || handoff.status === "REQUIRED" || handoff.status === "NOTIFICATION_PENDING") {
    return `Entendi que você quer falar diretamente com o Coringa${name}. Sua solicitação foi registrada; o aviso ainda não foi confirmado.`;
  }
  return reply;
}
