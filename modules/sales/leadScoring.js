export const LEAD_LEVELS = Object.freeze({
  COLD: "COLD",
  WARM: "WARM",
  HOT: "HOT",
  VERY_HOT: "VERY_HOT"
});

export const LEAD_SCORE_WEIGHTS = Object.freeze({
  tattooIntent: 5,
  referenceReceived: 10,
  imageReceived: 5,
  bodyLocation: 8,
  approximateSize: 8,
  firstTattoo: 3,
  priceInquiry: 10,
  estimatedPrice: 10,
  durationInquiry: 5,
  estimatedHours: 5,
  buyingSignal: 10,
  schedulingIntent: 15,
  paymentIntent: 20,
  reservationIntent: 20
});

const fact = (state, key) => state?.facts?.[key]?.value;

export function levelForScore(score) {
  if (score >= 70) return LEAD_LEVELS.VERY_HOT;
  if (score >= 40) return LEAD_LEVELS.HOT;
  if (score >= 20) return LEAD_LEVELS.WARM;
  return LEAD_LEVELS.COLD;
}

export function calculateLeadScore(conversationState = {}) {
  const breakdown = [];
  const add = (signal, points, reason) => breakdown.push({ signal, points, reason });
  const text = conversationState?.signals?.text || "";
  const recordedBuyingSignals = fact(conversationState, "buyingSignals") || [];
  const commercialEvidence = [...recordedBuyingSignals, text].join("\n");

  if (fact(conversationState, "tattooIntent")) add("tattooIntent", LEAD_SCORE_WEIGHTS.tattooIntent, "cliente demonstrou intenção de tattoo");
  if (fact(conversationState, "referenceReceived")) {
    add("referenceReceived", LEAD_SCORE_WEIGHTS.referenceReceived, "cliente enviou ou mencionou referência");
  } else if (fact(conversationState, "imageReceived")) {
    add("imageReceived", LEAD_SCORE_WEIGHTS.imageReceived, "cliente enviou imagem sem referência identificada");
  }
  if (fact(conversationState, "bodyLocation")) add("bodyLocation", LEAD_SCORE_WEIGHTS.bodyLocation, "local do corpo conhecido");
  if (fact(conversationState, "approximateSize")) add("approximateSize", LEAD_SCORE_WEIGHTS.approximateSize, "tamanho aproximado conhecido");
  if (fact(conversationState, "firstTattoo") !== null && fact(conversationState, "firstTattoo") !== undefined) {
    add("firstTattoo", LEAD_SCORE_WEIGHTS.firstTattoo, "experiência anterior com tattoo conhecida");
  }

  if (/pre[cç]o|valor|or[cç]amento|orcamento|quanto (?:fica|custa|sai)/iu.test(commercialEvidence)) {
    add("priceInquiry", LEAD_SCORE_WEIGHTS.priceInquiry, "cliente perguntou preço ou orçamento");
  }
  if (fact(conversationState, "estimatedPrice") !== null && fact(conversationState, "estimatedPrice") !== undefined) {
    add("estimatedPrice", LEAD_SCORE_WEIGHTS.estimatedPrice, "estimativa de preço explicitamente conhecida");
  }
  if (/quanto tempo|dura[cç][aã]o|quantas horas|demora/iu.test(commercialEvidence)) {
    add("durationInquiry", LEAD_SCORE_WEIGHTS.durationInquiry, "cliente perguntou duração do projeto");
  }
  if (fact(conversationState, "estimatedHours") !== null && fact(conversationState, "estimatedHours") !== undefined) {
    add("estimatedHours", LEAD_SCORE_WEIGHTS.estimatedHours, "estimativa de horas explicitamente conhecida");
  }

  const reservationIntent = /reservar|reserva(?:r| de)? (?:uma )?(?:data|hor[aá]rio|horario|tattoo)/iu.test(text);
  const paymentIntent = fact(conversationState, "paymentIntent") === true;
  const schedulingIntent = fact(conversationState, "schedulingIntent") === true;
  if (reservationIntent) {
    add("reservationIntent", LEAD_SCORE_WEIGHTS.reservationIntent, "cliente demonstrou intenção clara de reserva");
  } else if (paymentIntent) {
    add("paymentIntent", LEAD_SCORE_WEIGHTS.paymentIntent, "cliente demonstrou intenção de pagamento");
  } else if (schedulingIntent) {
    add("schedulingIntent", LEAD_SCORE_WEIGHTS.schedulingIntent, "cliente demonstrou intenção de agenda");
  }

  const positiveAcknowledgement = /^(gostei|curti|quero essa|pode ser|aceito)[.!?]*$/iu.test(text);
  const genericBuyingSignal = recordedBuyingSignals.some((item) =>
    !/pre[cç]o|valor|or[cç]amento|orcamento|quanto (?:fica|custa|sai|tempo)|dura[cç][aã]o|quantas horas|demora|pix|sinal|agendar|marcar|reservar/iu.test(item)
  );
  if (!reservationIntent && !paymentIntent && !schedulingIntent && (genericBuyingSignal || positiveAcknowledgement)) {
    add("buyingSignal", LEAD_SCORE_WEIGHTS.buyingSignal, "sinal de compra identificado");
  }

  const rawScore = breakdown.reduce((total, item) => total + item.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  if (rawScore > 100) add("scoreCap", 100 - rawScore, "limite máximo de 100 aplicado");

  return { score, level: levelForScore(score), breakdown };
}
