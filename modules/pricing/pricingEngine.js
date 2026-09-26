import { STUDIO_CATALOG } from "../../config/business/catalog.js";

export const PRICING_STATUS = Object.freeze({ INSUFFICIENT_DATA: "INSUFFICIENT_DATA", ESTIMATE_AVAILABLE: "ESTIMATE_AVAILABLE", HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED" });

export const OFFICIAL_PRICING = Object.freeze({
  currency: STUDIO_CATALOG.currency,
  minimum: Object.freeze({ amount: STUDIO_CATALOG.tattoo.minimum }),
  sessions: Object.freeze(Object.fromEntries(Object.entries(STUDIO_CATALOG.tattoo.sessions).map(([hours, amount]) =>
    [hours, Object.freeze({ hours: Number(hours), amount })]
  ))),
  deposit: Object.freeze({ amount: STUDIO_CATALOG.tattoo.deposit.amount })
});

const fact = (state, key) => state?.facts?.[key]?.value;
const money = (kind, amount, extra = {}) => ({ kind, amount, currency: OFFICIAL_PRICING.currency, ...extra });
const response = (status, estimate, knownFacts, missingFacts, reason) => ({ status, estimate, knownFacts, missingFacts, assumptions: [], reason });

export function evaluatePricing({ conversationState = {}, request = null } = {}) {
  const text = conversationState?.signals?.text || "";
  const knownFacts = [];
  for (const key of ["tattooIntent", "referenceReceived", "imageReceived", "bodyLocation", "approximateSize", "tattooStyle", "estimatedHours"]) {
    const value = fact(conversationState, key);
    if (value !== null && value !== undefined && value !== false) knownFacts.push({ key, value });
  }

  if (request === "DEPOSIT" || /quanto (?:[eé] )?o sinal|valor do sinal|sinal [eé] quanto/iu.test(text)) {
    return response(PRICING_STATUS.ESTIMATE_AVAILABLE, money("DEPOSIT", OFFICIAL_PRICING.deposit.amount), knownFacts, [], "valor oficial do sinal disponível");
  }
  if (request === "MINIMUM" || /valor m[ií]nimo|pre[cç]o m[ií]nimo|m[ií]nimo da tattoo/iu.test(text)) {
    return response(PRICING_STATUS.ESTIMATE_AVAILABLE, money("MINIMUM", OFFICIAL_PRICING.minimum.amount), knownFacts, [], "valor mínimo oficial disponível");
  }

  const requestedHours = request?.hours ?? fact(conversationState, "estimatedHours");
  if (requestedHours !== null && requestedHours !== undefined) {
    const officialSession = OFFICIAL_PRICING.sessions[Number(requestedHours)];
    if (officialSession) {
      return response(PRICING_STATUS.ESTIMATE_AVAILABLE, money("OFFICIAL_SESSION", officialSession.amount, { hours: officialSession.hours }), knownFacts, [], "sessão oficial exata disponível");
    }
    return response(PRICING_STATUS.HUMAN_REVIEW_REQUIRED, null, knownFacts, [], "não existe regra aprovada para interpolar esta duração");
  }

  const hasProject = fact(conversationState, "tattooIntent") === true;
  const hasReference = fact(conversationState, "referenceReceived") === true;
  const hasLocation = Boolean(fact(conversationState, "bodyLocation"));
  const missingFacts = [];
  if (!hasProject) missingFacts.push("tattooIntent");
  if (!hasReference) missingFacts.push("referenceReceived");
  if (!hasLocation) missingFacts.push("bodyLocation");
  if (hasProject && hasReference && hasLocation) {
    return response(PRICING_STATUS.HUMAN_REVIEW_REQUIRED, null, knownFacts, [], "projeto artístico conhecido, mas sem regra determinística de orçamento");
  }
  return response(PRICING_STATUS.INSUFFICIENT_DATA, null, knownFacts, missingFacts, "faltam dados essenciais para avaliar o projeto");
}
