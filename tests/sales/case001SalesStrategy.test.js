import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { determineSalesStrategy, SALES_OBJECTIVES } from "../../modules/sales/salesStrategy.js";

const base = { name: "Allef", previousStage: "novo" };

test("CASE-001: intenção inicial coleta referência sem handoff", () => {
  const state = buildConversationState({ ...base, text: "Quero fazer uma tattoo", currentStage: "quente" });
  const strategy = determineSalesStrategy(state);
  assert.equal(strategy.objective, SALES_OBJECTIVES.COLLECT_REFERENCE);
  assert.equal(strategy.shouldHandoff, false);
});

test("CASE-001: imagem inicia qualificação sem handoff", () => {
  const state = buildConversationState({
    ...base,
    text: "cliente enviou imagem de referência de tattoo",
    currentStage: "orcamento"
  });
  const strategy = determineSalesStrategy(state);
  assert.equal(strategy.objective, SALES_OBJECTIVES.QUALIFY_PROJECT);
  assert.equal(strategy.nextFact, "bodyLocation");
  assert.equal(strategy.shouldHandoff, false);
});

test("CASE-001: braço fechado continua qualificação/estimativa, nunca handoff", () => {
  const state = buildConversationState({
    ...base,
    text: "Braço fechado",
    history: [
      { role: "user", content: "Quero fazer uma tattoo" },
      { role: "user", content: "cliente enviou imagem de referência de tattoo", mediaType: "image" }
    ],
    previousStage: "orcamento",
    currentStage: "orcamento"
  });
  const strategy = determineSalesStrategy(state);
  assert.ok([SALES_OBJECTIVES.QUALIFY_PROJECT, SALES_OBJECTIVES.ESTIMATE_PROJECT].includes(strategy.objective));
  assert.notEqual(strategy.objective, SALES_OBJECTIVES.HANDOFF_CANDIDATE);
  assert.equal(strategy.shouldHandoff, false);
});
