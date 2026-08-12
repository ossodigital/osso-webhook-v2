import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState, CONVERSATION_OBJECTIVES } from "../../services/ai/conversationState.js";
import { CASE_001_CONVERSATION_STATE } from "../fixtures/case-001-conversation-state.js";

test("CASE-001 representa Allef sem falso handoff ou inferência inventada", () => {
  const state = buildConversationState(CASE_001_CONVERSATION_STATE);
  assert.equal(state.facts.name.value, "Allef");
  assert.equal(state.facts.tattooIntent.value, true);
  assert.equal(state.facts.referenceReceived.value, true);
  assert.equal(state.facts.imageReceived.value, true);
  assert.equal(state.facts.bodyLocation.value, "braço fechado");
  assert.equal(state.currentStage, "orcamento");
  assert.equal(state.facts.humanRequest.value, false);
  assert.equal(state.handoffCandidate.value, false);
  assert.equal(state.facts.estimatedHours.value, null);
  assert.equal(state.facts.estimatedPrice.value, null);
  assert.deepEqual(state.missingFacts, ["approximateSize", "firstTattoo"]);
  assert.equal(state.objective, CONVERSATION_OBJECTIVES.QUALIFY_PROJECT);
});
