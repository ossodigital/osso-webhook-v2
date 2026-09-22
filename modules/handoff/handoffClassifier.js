function hasClosingIntent(text) {
  const projectContexts = [
    "braço fechado", "braco fechado", "manga fechada", "fechamento de braço",
    "fechamento de braco", "fechar o braço", "fechar o braco"
  ];
  if (projectContexts.some((context) => text.includes(context))) return false;

  const withoutFinalPunctuation = text.replace(/[.!?]+$/gu, "").trim();
  if (withoutFinalPunctuation === "fechado") return true;

  return [
    "quero fechar", "fechar agora", "vamos fechar", "pode fechar", "bora fechar",
    "ta bom vamos fechar", "tá bom vamos fechar"
  ].some((intent) => text.includes(intent));
}

export function classifyHandoffSignals({ text = "", signals = null } = {}) {
  const normalizedText = String(text).toLowerCase().trim();
  const candidates = [];
  const add = (reason, matches) => {
    if (matches) candidates.push(reason);
  };

  add("SCHEDULING_COMPATIBILITY", [
    "quero reservar", "reservar horário", "reservar horario", "reservar tattoo",
    "quero marcar", "marcar tattoo", "marcar tatuagem", "quero agendar", "pode agendar"
  ].some((value) => normalizedText.includes(value)));
  add("CLOSING_COMPATIBILITY", hasClosingIntent(normalizedText));
  add("PAYMENT_COMPATIBILITY", [
    "vou pagar", "manda pix", "manda o pix", "pagar o sinal", "quanto é o sinal", "quanto e o sinal"
  ].some((value) => normalizedText.includes(value)));
  add("HUMAN_REQUEST_COMPATIBILITY", [
    "atendimento humano", "falar com humano", "falar com coringa", "chama o coringa",
    "quero falar com o coringa", "me passa o número", "me passa o numero", "me passa o contato"
  ].some((value) => normalizedText.includes(value)));
  add("ACCEPTANCE_COMPATIBILITY", normalizedText.includes("aceito"));

  return {
    candidates,
    compatibilityTrigger: candidates.length > 0,
    compatibilityBlocked: /calote|golpe|zoeira|brincadeira|kkk|kkkk/iu.test(normalizedText),
    signalCategories: signals?.categories || []
  };
}
