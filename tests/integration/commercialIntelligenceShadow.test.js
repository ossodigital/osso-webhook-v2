import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { determineSalesStrategy } from "../../modules/sales/salesStrategy.js";
import { calculateLeadScore } from "../../modules/sales/leadScoring.js";
import { evaluatePricing } from "../../modules/pricing/pricingEngine.js";
import { classifyObjection } from "../../modules/sales/objectionEngine.js";

test("pipeline comercial shadow produz somente objetos sem mensagem ou efeitos", () => {
  const text = "Está caro, vou pensar.";
  const state = buildConversationState({ text, previousStage: "orcamento", currentStage: "orcamento" });
  const outputs = {
    state,
    strategy: determineSalesStrategy(state),
    scoring: calculateLeadScore(state),
    pricing: evaluatePricing({ conversationState: state }),
    objection: classifyObjection({ text, conversationState: state }),
    waiting: state.waitingForCustomer
  };

  assert.equal(outputs.waiting, true);
  assert.equal(outputs.objection.hasObjection, true);
  assert.equal(outputs.strategy.shouldWait, true);
  assert.equal("reply" in outputs.strategy, false);
  assert.equal("shouldHandoff" in outputs.scoring, false);
  assert.equal("message" in outputs.pricing, false);
});
