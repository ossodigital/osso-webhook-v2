export const SIGNAL_CATEGORIES = Object.freeze({
  STAGE_SIGNAL: "STAGE_SIGNAL",
  BUYING_SIGNAL: "BUYING_SIGNAL",
  HANDOFF_SIGNAL: "HANDOFF_SIGNAL",
  QUALIFICATION_FACT: "QUALIFICATION_FACT",
  OBJECTION: "OBJECTION",
  PAYMENT_INTENT: "PAYMENT_INTENT",
  SCHEDULING_INTENT: "SCHEDULING_INTENT",
  HUMAN_REQUEST: "HUMAN_REQUEST",
  AMBIGUOUS: "AMBIGUOUS"
});

export function classifySignals({ text = "", previousStage = null } = {}) {
  const normalizedText = String(text).toLowerCase().trim();
  const categories = new Set();

  const add = (category, pattern) => {
    if (pattern.test(normalizedText)) categories.add(category);
  };

  add(SIGNAL_CATEGORIES.PAYMENT_INTENT, /pix|cart[aã]o|cartao|sinal|vou pagar|pagar/iu);
  add(SIGNAL_CATEGORIES.SCHEDULING_INTENT, /reservar|agendar|marcar|hor[aá]rio|horario|agenda|quando pode|qual dia|tem vaga/iu);
  add(SIGNAL_CATEGORIES.HUMAN_REQUEST, /atendimento humano|falar com humano|falar com (?:o )?coringa|chama o coringa|me passa (?:o )?(?:n[uú]mero|numero|contato)|falar com (?:uma pessoa|algu[eé]m|o tatuador)/iu);
  add(SIGNAL_CATEGORIES.OBJECTION, /vou pensar|vou ver|te aviso|conversar e te falo|falar com minha esposa|caro|mais barato|desconto|parcelar|medo da dor|n[aã]o sei se vou aguentar|n[aã]o tenho tempo|demora muito/iu);
  add(SIGNAL_CATEGORIES.QUALIFICATION_FACT, /bra[cç]o fechado|manga fechada|meia manga|costas fechadas|fechamento de bra[cç]o|imagem de (?:refer[eê]ncia de )?tattoo/iu);
  add(SIGNAL_CATEGORIES.BUYING_SIGNAL, /pix|cart[aã]o|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer|aceito/iu);
  add(SIGNAL_CATEGORIES.STAGE_SIGNAL, /calote|golpe|zoeira|brincadeira|kkk|pix|cart[aã]o|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer|agendar|marcar|hor[aá]rio|horario|agenda|quando pode|qual dia|tem vaga|pre[cç]o|valor|quanto|or[cç]amento|orcamento|custa|tattoo|tatuagem/iu);
  add(SIGNAL_CATEGORIES.AMBIGUOUS, /^(?:fechado|aceito|pode ser)[.!?]*$|(?:^|\s)(?:me passa o contato|[eé] o coringa\??|voc[eê] [eé] o coringa\??)/iu);
  if (categories.has(SIGNAL_CATEGORIES.HUMAN_REQUEST)) {
    categories.add(SIGNAL_CATEGORIES.HANDOFF_SIGNAL);
  }

  return {
    text: normalizedText,
    previousStage,
    categories: [...categories]
  };
}
