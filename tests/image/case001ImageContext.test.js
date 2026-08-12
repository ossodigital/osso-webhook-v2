import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_SOURCES } from "../../modules/image/imageContext.js";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { determineSalesStrategy, SALES_OBJECTIVES } from "../../modules/sales/salesStrategy.js";
import { evaluatePricing, PRICING_STATUS } from "../../modules/pricing/pricingEngine.js";
import { CASE_001_CONVERSATION_STATE } from "../fixtures/case-001-conversation-state.js";

test("CASE-001 mantém referência visual e local desejado distintos em shadow mode", () => {
  const state = buildConversationState({
    ...CASE_001_CONVERSATION_STATE,
    imageAnalysis: {
      tattooStyle: { value: "black and grey / realismo", confidence: "medium", source: IMAGE_SOURCES.MODEL_INFERENCE },
      visualElements: ["figura religiosa", "sombreamento"],
      uncertainties: ["local da referência não está visualmente claro"]
    }
  });
  const strategy = determineSalesStrategy(state);
  const pricing = evaluatePricing({ conversationState: state });

  assert.equal(state.imageContext.hasReference, true);
  assert.equal(state.facts.referenceReceived.value, true);
  assert.equal(state.facts.tattooStyle.confidence, "medium");
  assert.equal(state.facts.bodyLocation.value, "braço fechado");
  assert.equal(state.facts.bodyLocation.source, "customer_explicit");
  assert.equal(state.imageContext.bodyPlacementShown.value, null);
  assert.equal(state.handoffCandidate.value, false);
  assert.notEqual(strategy.objective, SALES_OBJECTIVES.HANDOFF_CANDIDATE);
  assert.equal(pricing.status, PRICING_STATUS.HUMAN_REVIEW_REQUIRED);
  assert.equal(state.facts.estimatedPrice.value, null);
  assert.equal(state.facts.estimatedHours.value, null);
  assert.ok(!JSON.stringify(state).includes("850"));
});
