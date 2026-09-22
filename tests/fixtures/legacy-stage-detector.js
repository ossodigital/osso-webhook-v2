function hasLegacyClosingIntent(text) {
  const projectContexts = [
    "braço fechado", "braco fechado", "manga fechada", "fechamento de braço",
    "fechamento de braco", "fechar o braço", "fechar o braco"
  ];
  if (projectContexts.some((context) => text.includes(context))) return false;
  if (text.replace(/[.!?]+$/gu, "").trim() === "fechado") return true;
  return [
    "quero fechar", "fechar agora", "vamos fechar", "pode fechar", "bora fechar",
    "ta bom vamos fechar", "tá bom vamos fechar"
  ].some((intent) => text.includes(intent));
}

export function legacyDetectStage(userText = "", existingStage = null) {
  const text = userText.toLowerCase().trim();
  if (/calote|golpe|zoeira|brincadeira|kkk|kkkk/iu.test(text)) return "curioso";
  if (
    [
      "quero reservar", "reservar horário", "reservar horario", "reservar tattoo",
      "quero marcar", "marcar tattoo", "marcar tatuagem", "quero agendar", "pode agendar"
    ].some((value) => text.includes(value)) ||
    hasLegacyClosingIntent(text) ||
    [
      "vou pagar", "manda pix", "manda o pix", "atendimento humano", "falar com humano",
      "falar com coringa", "chama o coringa", "quero falar com o coringa", "me passa o número",
      "me passa o numero", "me passa o contato", "pagar o sinal", "quanto é o sinal",
      "quanto e o sinal", "aceito"
    ].some((value) => text.includes(value))
  ) return "humano";
  if (/pix|cart[aã]o|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer/iu.test(text)) return "quente";
  if (/agendar|marcar|hor[aá]rio|horario|agenda|quando pode|qual dia|tem vaga/iu.test(text)) return "agendamento";
  if (/pre[cç]o|valor|quanto|or[cç]amento|orcamento|custa|tattoo|tatuagem/iu.test(text)) return "orcamento";
  return existingStage || "novo";
}
