import test from "node:test";
import assert from "node:assert/strict";
import detectarStage from "../../modules/stages/stageDetector.js";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { determineSalesStrategy, SALES_ACTIONS, SALES_OBJECTIVES } from "../../modules/sales/salesStrategy.js";

function strategyFor(text, previousStage = "novo", options = {}) {
  const currentStage = options.currentStage || detectarStage(text, previousStage);
  const state = buildConversationState({ text, previousStage, currentStage, ...options });
  return determineSalesStrategy(state);
}

test("descobre intenção quando objetivo do cliente é desconhecido", () => {
  assert.equal(strategyFor("Oi").objective, SALES_OBJECTIVES.DISCOVER_INTENT);
});

test("coleta referência quando intenção de tattoo já existe", () => {
  assert.equal(strategyFor("Quero fazer uma tattoo").objective, SALES_OBJECTIVES.COLLECT_REFERENCE);
});

test("seleciona somente o próximo fato relevante", () => {
  const strategy = strategyFor("cliente enviou imagem de referência de tattoo", "quente");
  assert.equal(strategy.objective, SALES_OBJECTIVES.QUALIFY_PROJECT);
  assert.equal(strategy.action, SALES_ACTIONS.ASK_MISSING_FACT);
  assert.equal(strategy.nextFact, "bodyLocation");
});

test("Quanto fica orienta estimativa de projeto", () => {
  assert.equal(strategyFor("Quanto fica?").objective, SALES_OBJECTIVES.ESTIMATE_PROJECT);
});

test("Quanto é o sinal orienta pagamento sem handoff", () => {
  const strategy = strategyFor("Quanto é o sinal?");
  assert.equal(strategy.objective, SALES_OBJECTIVES.PAYMENT);
  assert.equal(strategy.shouldHandoff, false);
});

test("Quero marcar orienta agenda", () => {
  assert.equal(strategyFor("Quero marcar").objective, SALES_OBJECTIVES.SCHEDULE);
});

test("pedido explícito do Coringa vira somente candidato", () => {
  const strategy = strategyFor("Quero falar com o Coringa");
  assert.equal(strategy.objective, SALES_OBJECTIVES.HANDOFF_CANDIDATE);
  assert.equal(strategy.shouldHandoff, false);
});

test("Vou pensar exige espera sem nova ação", () => {
  const strategy = strategyFor("Vou pensar", "orcamento");
  assert.equal(strategy.objective, SALES_OBJECTIVES.WAIT_FOR_CUSTOMER);
  assert.equal(strategy.action, SALES_ACTIONS.NO_ACTION);
  assert.equal(strategy.shouldWait, true);
});

test("Está caro orienta tratamento de objeção", () => {
  assert.equal(strategyFor("Está caro", "orcamento").objective, SALES_OBJECTIVES.HANDLE_OBJECTION);
});

test("Gostei orienta checagem de intenção de compra sem handoff", () => {
  const strategy = strategyFor("Gostei", "orcamento");
  assert.equal(strategy.objective, SALES_OBJECTIVES.CHECK_BUYING_INTENT);
  assert.equal(strategy.shouldHandoff, false);
});

test("contrato não contém texto de resposta ao cliente", () => {
  const strategy = strategyFor("Oi");
  assert.deepEqual(Object.keys(strategy), ["objective", "action", "priority", "reason", "nextFact", "shouldWait", "shouldHandoff"]);
  assert.equal("reply" in strategy, false);
  assert.equal("message" in strategy, false);
});
