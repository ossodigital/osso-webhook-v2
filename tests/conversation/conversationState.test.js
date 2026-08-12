import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState, CONVERSATION_OBJECTIVES, isWaitingForCustomer } from "../../services/ai/conversationState.js";

for (const text of ["Vou pensar", "te aviso", "vou ver e te falo"]) {
  test(`waiting_for_customer: ${text}`, () => {
    const state = buildConversationState({ text, previousStage: "orcamento", currentStage: "orcamento" });
    assert.equal(state.waitingForCustomer, true);
    assert.equal(state.objective, CONVERSATION_OBJECTIVES.WAIT);
  });
}

for (const text of ["quanto fica?", "qual dia tem?"]) {
  test(`não entra em waiting_for_customer: ${text}`, () => {
    assert.equal(isWaitingForCustomer({ text }), false);
  });
}

test("conversation state preserva stages e calcula sem efeitos", () => {
  const state = buildConversationState({ text: "Quero agendar", previousStage: "quente", currentStage: "humano" });
  assert.equal(state.previousStage, "quente");
  assert.equal(state.currentStage, "humano");
  assert.equal(state.objective, CONVERSATION_OBJECTIVES.SCHEDULE);
  assert.equal("shouldHandoff" in state, false);
});

test("pedido humano vira apenas candidato observacional", () => {
  const state = buildConversationState({ text: "Quero falar com o Coringa", currentStage: "novo" });
  assert.equal(state.handoffCandidate.value, true);
  assert.equal(state.currentStage, "novo");
});

test("seleciona objetivos de pagamento, objeção e descoberta", () => {
  assert.equal(buildConversationState({ text: "Como pago o sinal?" }).objective, CONVERSATION_OBJECTIVES.PAYMENT);
  assert.equal(buildConversationState({ text: "Está caro" }).objective, CONVERSATION_OBJECTIVES.HANDLE_OBJECTION);
  assert.equal(buildConversationState({ text: "Olá" }).objective, CONVERSATION_OBJECTIVES.DISCOVER_INTENT);
});
