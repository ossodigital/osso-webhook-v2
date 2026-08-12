import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { determineSalesStrategy } from "../../modules/sales/salesStrategy.js";
import { mergeLeadMemory } from "../../modules/memory/leadMemory.js";
import { CONTEXT_DECISIONS, CONTEXT_FACTS, evaluateContextPolicy } from "../../modules/conversation/contextPolicy.js";
import { CASE_001_CONVERSATION_STATE } from "../fixtures/case-001-conversation-state.js";

test("CTX-020: CASE-001 não repete nome, referência ou local e não cria handoff", () => {
  const state = buildConversationState(CASE_001_CONVERSATION_STATE);
  const memory = mergeLeadMemory(null, state);
  const policy = evaluateContextPolicy({
    memory,
    conversationState: state,
    salesStrategy: determineSalesStrategy(state)
  });

  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.NAME));
  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.TATTOO_INTENT));
  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.REFERENCE));
  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.BODY_LOCATION));
  assert.ok(policy.blockedQuestions.includes(CONTEXT_FACTS.NAME));
  assert.ok(policy.blockedQuestions.includes(CONTEXT_FACTS.REFERENCE));
  assert.ok(policy.blockedQuestions.includes(CONTEXT_FACTS.BODY_LOCATION));
  assert.equal(policy.nextFact, CONTEXT_FACTS.SIZE);
  assert.equal(policy.decision, CONTEXT_DECISIONS.ASK_NEXT_FACT);
  assert.equal("shouldHandoff" in policy, false);
});
