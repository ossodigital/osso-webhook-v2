export default function detectarStage(userText = "", existingStage = null) {
  const text = userText.toLowerCase().trim();

  if (/calote|golpe|zoeira|brincadeira|kkk|kkkk/i.test(text)) {
    return "curioso";
  }

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
    text.includes("chama o coringa")
  ) {
    return "humano";
  }

  if (/pix|cartão|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer/i.test(text)) {
    return "quente";
  }

  if (/agendar|marcar|horário|horario|agenda|quando pode|qual dia/i.test(text)) {
    return "agendamento";
  }

  if (/preço|valor|quanto|orçamento|orcamento|custa|tattoo|tatuagem/i.test(text)) {
    return "orcamento";
  }

  return existingStage || "novo";
}
