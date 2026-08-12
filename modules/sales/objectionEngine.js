export const OBJECTION_TYPES = Object.freeze({ PRICE: "PRICE", DISCOUNT: "DISCOUNT", PAIN: "PAIN", TIME: "TIME", INDECISION: "INDECISION", COMPARISON: "COMPARISON", PAYMENT: "PAYMENT", OTHER: "OTHER" });

const RULES = Object.freeze([
  { type: OBJECTION_TYPES.COMPARISON, pattern: /outro tatuador|em outro (?:lugar|est[uú]dio)|concorrente|mais barato/iu, strategy: "EXPLAIN_VALUE" },
  { type: OBJECTION_TYPES.DISCOUNT, pattern: /desconto|faz por menos|melhorar o valor|baixar o pre[cç]o/iu, strategy: "CLARIFY_SCOPE" },
  { type: OBJECTION_TYPES.PAYMENT, pattern: /parcelar|parcela|forma de pagamento|consigo pagar|como pago/iu, strategy: "DISCUSS_PAYMENT_OPTIONS" },
  { type: OBJECTION_TYPES.PAIN, pattern: /medo da dor|vai doer|d[oó]i muito|n[aã]o (?:vou|sei se vou) aguentar/iu, strategy: "EXPLAIN_PROCESS" },
  { type: OBJECTION_TYPES.TIME, pattern: /n[aã]o tenho tempo|demora muito|tempo demais|muitas horas/iu, strategy: "CLARIFY_SCOPE" },
  { type: OBJECTION_TYPES.PRICE, pattern: /est[aá] caro|muito caro|valor alto|pre[cç]o alto/iu, strategy: "EXPLAIN_VALUE" },
  { type: OBJECTION_TYPES.INDECISION, pattern: /vou pensar|vou ver|te aviso|n[aã]o sei se quero|conversar e te falo/iu, strategy: "WAIT" }
]);

export function classifyObjection({ text = "", conversationState = null } = {}) {
  const normalizedText = String(text || conversationState?.signals?.text || "").toLowerCase().trim();
  const matches = RULES.filter((rule) => rule.pattern.test(normalizedText));
  if (!matches.length && /tenho (?:uma )?(?:preocupa[cç][aã]o|quest[aã]o|receio)|isso [eé] um problema|n[aã]o gostei/iu.test(normalizedText)) {
    return { hasObjection: true, type: OBJECTION_TYPES.OTHER, confidence: "medium", signals: [OBJECTION_TYPES.OTHER], recommendedStrategy: "HUMAN_REVIEW" };
  }
  if (!matches.length) return { hasObjection: false, type: null, confidence: null, signals: [], recommendedStrategy: null };
  return { hasObjection: true, type: matches[0].type, confidence: "high", signals: matches.map((rule) => rule.type), recommendedStrategy: matches[0].strategy };
}
