import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { evaluatePricing, PRICING_STATUS } from "../../modules/pricing/pricingEngine.js";

test("CASE-001 não transforma R$850 observado em regra global", () => {
  const state = buildConversationState({
    name: "Allef",
    text: "Braço fechado",
    history: [
      { role: "user", content: "Quero fazer uma tattoo" },
      { role: "user", content: "cliente enviou imagem de referência de tattoo", mediaType: "image" }
    ],
    previousStage: "orcamento",
    currentStage: "orcamento"
  });
  const result = evaluatePricing({ conversationState: state });
  assert.equal(result.status, PRICING_STATUS.HUMAN_REVIEW_REQUIRED);
  assert.equal(result.estimate, null);
  assert.ok(!JSON.stringify(result).includes("850"));
});
