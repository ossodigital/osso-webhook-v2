import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState, isWaitingForCustomer } from "../../services/ai/conversationState.js";
import { classifyObjection, OBJECTION_TYPES } from "../../modules/sales/objectionEngine.js";
import { determineSalesStrategy, SALES_OBJECTIVES } from "../../modules/sales/salesStrategy.js";

for (const text of ["Vou pensar", "vou ver", "te aviso", "vou conversar e te falo"]) {
  test(`consolida WAIT: ${text}`, () => assert.equal(isWaitingForCustomer({ text }), true));
}

for (const text of ["quanto fica?", "qual dia tem?", "como pago?", "tem desconto?"]) {
  test(`não classifica pergunta como WAIT: ${text}`, () => assert.equal(isWaitingForCustomer({ text }), false));
}

test("objeção e WAIT coexistem sem sugerir nova ação", () => {
  const text = "Está caro, vou pensar.";
  const state = buildConversationState({ text, previousStage: "orcamento", currentStage: "orcamento" });
  const objection = classifyObjection({ text });
  const strategy = determineSalesStrategy(state);
  assert.equal(objection.type, OBJECTION_TYPES.PRICE);
  assert.ok(objection.signals.includes(OBJECTION_TYPES.INDECISION));
  assert.equal(state.waitingForCustomer, true);
  assert.equal(strategy.objective, SALES_OBJECTIVES.WAIT_FOR_CUSTOMER);
  assert.equal(strategy.shouldWait, true);
});
