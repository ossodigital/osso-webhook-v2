import test from "node:test";
import assert from "node:assert/strict";
import { classifySignals, SIGNAL_CATEGORIES } from "../../modules/conversation/signalClassifier.js";
import { classifyHandoffSignals } from "../../modules/handoff/handoffClassifier.js";
import { decideHandoff } from "../../modules/handoff/handoffPolicy.js";
import { classifyStage } from "../../modules/stages/stageClassifier.js";
import { toLegacyStage } from "../../modules/stages/stageCompatibility.js";
import detectarStage, { classifyConversationCompatibility } from "../../modules/stages/stageDetector.js";
import { HANDOFF_AUDIT_CASES, PREVIOUS_STAGES } from "../fixtures/handoff-audit-matrix.js";
import { legacyDetectStage } from "../fixtures/legacy-stage-detector.js";

test("stageClassifier classifica stage sem decidir handoff", () => {
  assert.equal(classifyStage({ text: "Quanto é o sinal?", previousStage: "novo" }), "quente");
  assert.equal(classifyStage({ text: "Quero marcar", previousStage: "novo" }), "agendamento");
});

test("signalClassifier permite payment + buying sem handoff signal automático", () => {
  const result = classifySignals({ text: "Quanto é o sinal?", previousStage: "novo" });
  assert.ok(result.categories.includes(SIGNAL_CATEGORIES.PAYMENT_INTENT));
  assert.ok(result.categories.includes(SIGNAL_CATEGORIES.BUYING_SIGNAL));
  assert.ok(!result.categories.includes(SIGNAL_CATEGORIES.HANDOFF_SIGNAL));
});

test("signalClassifier reconhece pedido humano sem executar efeito", () => {
  const result = classifySignals({ text: "Quero falar com alguém" });
  assert.ok(result.categories.includes(SIGNAL_CATEGORIES.HUMAN_REQUEST));
  assert.ok(result.categories.includes(SIGNAL_CATEGORIES.HANDOFF_SIGNAL));
});

test("handoffClassifier retorna candidatos, sem decisão ou efeito", () => {
  const result = classifyHandoffSignals({ text: "Quero falar com o Coringa" });
  assert.deepEqual(result.candidates, ["HUMAN_REQUEST_COMPATIBILITY"]);
  assert.equal("shouldHandoff" in result, false);
});

test("handoffClassifier preserva BUG-003 no modo compatível", () => {
  assert.equal(classifyHandoffSignals({ text: "Quero falar com alguém" }).compatibilityTrigger, false);
});

test("handoffPolicy decide de forma pura no modo compatível", () => {
  const decision = decideHandoff({
    stage: "quente",
    handoff: { compatibilityTrigger: true, compatibilityBlocked: false, candidates: ["PAYMENT_COMPATIBILITY"] },
    compatibilityMode: true
  });
  assert.deepEqual(decision, { shouldHandoff: true, reason: "PAYMENT_COMPATIBILITY" });
});

test("handoffPolicy desativada não antecipa nova política comercial", () => {
  const decision = decideHandoff({ handoff: { compatibilityTrigger: true }, compatibilityMode: false });
  assert.deepEqual(decision, { shouldHandoff: false, reason: null });
});

test("stageCompatibility traduz decisão para stage legado humano", () => {
  assert.equal(toLegacyStage({ stage: "quente", handoffDecision: { shouldHandoff: true } }), "humano");
  assert.equal(toLegacyStage({ stage: "orcamento", handoffDecision: { shouldHandoff: false } }), "orcamento");
});

test("fachada expõe shadow data sem logs ou efeitos", () => {
  const result = classifyConversationCompatibility("Quero marcar", "novo");
  assert.equal(result.stage, "agendamento");
  assert.equal(result.handoffDecision.shouldHandoff, true);
  assert.equal(result.legacyStage, "humano");
});

for (const [input] of HANDOFF_AUDIT_CASES) {
  for (const previousStage of PREVIOUS_STAGES) {
    test(`OLD vs NEW: ${input} [anterior=${previousStage}]`, () => {
      const oldStage = legacyDetectStage(input, previousStage);
      const newStage = detectarStage(input, previousStage);
      assert.equal(newStage, oldStage);
      assert.equal(newStage === "humano", oldStage === "humano");
    });
  }
}
