import test from "node:test";
import assert from "node:assert/strict";
import { calculateLeadScore } from "../../modules/sales/leadScoring.js";
import { buildConversationState } from "../../services/ai/conversationState.js";

const steps = [
  { text: "Quero fazer uma tattoo", currentStage: "quente" },
  { text: "cliente enviou imagem de referência de tattoo", currentStage: "orcamento" },
  { text: "Braço fechado", currentStage: "orcamento" },
  { text: "Quanto fica?", currentStage: "orcamento" },
  { text: "Quanto tempo demora?", currentStage: "orcamento" }
];

test("CASE-001 cresce progressivamente sem inventar fatos ou handoff", () => {
  const history = [];
  const scores = [];

  for (const step of steps) {
    const state = buildConversationState({
      name: "Allef",
      text: step.text,
      history,
      previousStage: step.currentStage,
      currentStage: step.currentStage
    });
    const result = calculateLeadScore(state);
    scores.push(result.score);
    assert.equal("shouldHandoff" in result, false);
    assert.equal(state.handoffCandidate.value, false);
    assert.equal(state.facts.estimatedPrice.value, null);
    assert.equal(state.facts.estimatedHours.value, null);
    history.push({ role: "user", content: step.text });
  }

  for (let index = 1; index < scores.length; index += 1) {
    assert.ok(scores[index] > scores[index - 1], `${scores[index]} deveria superar ${scores[index - 1]}`);
  }
  assert.deepEqual(scores, [15, 25, 33, 43, 48]);
});
