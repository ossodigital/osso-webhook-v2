export default function detectarStage(userText = "", existingStage = null) {
  const text = userText.toLowerCase().trim();

  // ─── CURIOSO / SPAM ──────────────────────────────────────────────────────
  if (/calote|golpe|zoeira|brincadeira|kkk|kkkk/i.test(text)) {
    return "curioso";
  }

  // ─── HUMANO — handoff imediato ───────────────────────────────────────────
  if (
    text.includes("quero reservar") ||
    text.includes("reservar horário") ||
    text.includes("reservar horario") ||
    text.includes("reservar tattoo") ||
    text.includes("quero marcar") ||
    text.includes("marcar tattoo") ||
    text.includes("marcar tatuagem") ||
    text.includes("quero agendar") ||
    text.includes("pode agendar") ||
    text.includes("quero fechar") ||
    text.includes("fechar agora") ||
    text.includes("vamos fechar") ||
    text.includes("vou pagar") ||
    text.includes("manda pix") ||
    text.includes("manda o pix") ||
    text.includes("atendimento humano") ||
    text.includes("falar com humano") ||
    text.includes("falar com coringa") ||
    text.includes("chama o coringa") ||
    text.includes("quero falar com o coringa") ||
    text.includes("me passa o número") ||
    text.includes("me passa o numero") ||
    text.includes("me passa o contato") ||
    text.includes("pagar o sinal") ||
    text.includes("quanto é o sinal") ||
    text.includes("quanto e o sinal") ||
    text.includes("aceito") ||
    text.includes("fechado") ||
    text.includes("bora fechar") ||
    text.includes("ta bom vamos fechar") ||
    text.includes("tá bom vamos fechar")
  ) {
    return "humano";
  }

  // ─── QUENTE — intenção de compra ─────────────────────────────────────────
  if (/pix|cart[aã]o|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer/i.test(text)) {
    return "quente";
  }

  // ─── AGENDAMENTO ─────────────────────────────────────────────────────────
  if (/agendar|marcar|hor[aá]rio|horario|agenda|quando pode|qual dia|tem vaga/i.test(text)) {
    return "agendamento";
  }

  // ─── ORÇAMENTO ───────────────────────────────────────────────────────────
  if (/pre[çc]o|valor|quanto|or[çc]amento|orcamento|custa|tattoo|tatuagem/i.test(text)) {
    return "orcamento";
  }

  return existingStage || "novo";
}