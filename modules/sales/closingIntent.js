const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim();

export function classifyClosingIntent({ text = "", hasCommercialContext = false } = {}) {
  const value = normalize(text);
  const paymentIntent = /\b(pix|sinal|pagar|pagamento|cartao|parcelar)\b/u.test(value);
  const schedulingIntent = /\b(agendar|agenda|horario|marcar|reservar|vaga)\b/u.test(value);
  const explicitClosing = /\b(quero|vamos|pode|vou)\s+(?:fechar|confirmar)\b|\bfechar\s+hoje\b/u.test(value);
  const tattooCommitment = /\bquero\s+fazer\s+(?:a|essa|uma)?\s*(?:tattoo|tatuagem)\b/u.test(value);
  const readyToClose = explicitClosing || (paymentIntent && schedulingIntent) ||
    (paymentIntent && hasCommercialContext) || (schedulingIntent && tattooCommitment && /\bcoringa\b/u.test(value));
  return { paymentIntent, schedulingIntent, explicitClosing, readyToClose };
}
