import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePricing, OFFICIAL_PRICING, PRICING_STATUS } from "../../modules/pricing/pricingEngine.js";
import { buildConversationState } from "../../services/ai/conversationState.js";

const stateFor = (text, options = {}) => buildConversationState({ text, currentStage: "orcamento", ...options });

test("fonte oficial contém mínimo, sessões e sinal", () => {
  assert.equal(OFFICIAL_PRICING.minimum.amount, 150);
  assert.equal(OFFICIAL_PRICING.sessions[3].amount, 650);
  assert.equal(OFFICIAL_PRICING.sessions[6].amount, 1200);
  assert.equal(OFFICIAL_PRICING.deposit.amount, 100);
});

test("retorna mínimo oficial", () => {
  const result = evaluatePricing({ conversationState: stateFor("Qual o valor mínimo?"), request: "MINIMUM" });
  assert.equal(result.status, PRICING_STATUS.ESTIMATE_AVAILABLE);
  assert.equal(result.estimate.amount, 150);
});

for (const [hours, amount] of [[3, 650], [6, 1200]]) {
  test(`retorna sessão oficial de ${hours}h`, () => {
    const result = evaluatePricing({ request: { hours } });
    assert.deepEqual(result.estimate, { kind: "OFFICIAL_SESSION", amount, currency: "BRL", hours });
  });
}

test("responde sinal oficial sem decisão de handoff", () => {
  const result = evaluatePricing({ conversationState: stateFor("Quanto é o sinal?") });
  assert.equal(result.status, PRICING_STATUS.ESTIMATE_AVAILABLE);
  assert.equal(result.estimate.amount, 100);
  assert.equal("shouldHandoff" in result, false);
});

test("dados insuficientes permanecem explícitos", () => {
  const result = evaluatePricing({ conversationState: stateFor("Quanto fica?") });
  assert.equal(result.status, PRICING_STATUS.INSUFFICIENT_DATA);
  assert.deepEqual(result.missingFacts, ["tattooIntent", "referenceReceived", "bodyLocation"]);
  assert.equal(result.estimate, null);
});

for (const hours of [4, 5]) {
  test(`não interpola sessão de ${hours}h`, () => {
    const result = evaluatePricing({ request: { hours } });
    assert.equal(result.status, PRICING_STATUS.HUMAN_REVIEW_REQUIRED);
    assert.equal(result.estimate, null);
    assert.deepEqual(result.assumptions, []);
  });
}

test("projeto artístico qualificado exige revisão humana", () => {
  const state = stateFor("Braço fechado", {
    history: [
      { role: "user", content: "Quero fazer uma tattoo" },
      { role: "user", content: "cliente enviou imagem de referência de tattoo" }
    ]
  });
  const result = evaluatePricing({ conversationState: state });
  assert.equal(result.status, PRICING_STATUS.HUMAN_REVIEW_REQUIRED);
  assert.equal(result.estimate, null);
});
