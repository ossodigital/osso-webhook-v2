import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { IMAGE_SOURCES } from "../../modules/image/imageContext.js";
import { MEMORY_SOURCES, getMissingQualification, mergeLeadMemory } from "../../modules/memory/leadMemory.js";
import { CASE_001_CONVERSATION_STATE } from "../fixtures/case-001-conversation-state.js";

test("MEM-018: CASE-001 completo preserva somente fatos sustentados", () => {
  const state = buildConversationState({
    ...CASE_001_CONVERSATION_STATE,
    imageAnalysis: {
      tattooStyle: { value: "black and grey / realismo", confidence: "medium", source: IMAGE_SOURCES.IMAGE_OBSERVATION },
      visualElements: ["figura religiosa", "sombreamento"]
    }
  });
  const memory = mergeLeadMemory(null, state);

  assert.equal(memory.identity.name, "Allef");
  assert.equal(memory.tattoo.intent, true);
  assert.equal(memory.tattoo.referenceReceived, true);
  assert.equal(memory.tattoo.bodyLocation, "braço fechado");
  assert.equal(memory.tattoo.style, "black and grey / realismo");
  assert.equal(memory.provenance["tattoo.style"].source, MEMORY_SOURCES.IMAGE_OBSERVATION);
  assert.equal(memory.commercial.quotedPrice, null);
  assert.equal(memory.commercial.estimatedHours, null);
  assert.equal(memory.commercial.estimatedSessions, null);
  assert.equal(memory.commercial.paymentDiscussed, false);
  assert.equal(memory.commercial.schedulingIntent, false);
  assert.equal(memory.conversation.humanRequested, false);
  assert.equal("handoff" in memory, false);
  assert.equal(memory.tattoo.firstTattoo, null);
  assert.deepEqual(getMissingQualification(memory), ["tattoo.size", "tattoo.firstTattoo"]);
  assert.ok(!JSON.stringify(memory).includes("850"));
});
