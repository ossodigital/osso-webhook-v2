import test from "node:test";
import assert from "node:assert/strict";
import detectarStage from "../../modules/stages/stageDetector.js";
import { CASE_001_ALLEF } from "../fixtures/case-001-allef.js";

const characterizationMatrix = [
  ["Braço fechado", "novo"],
  ["Quero fazer uma tattoo", "quente"],
  ["Quanto fica?", "orcamento"],
  ["Quanto custa?", "orcamento"],
  ["Queria um orçamento", "orcamento"],
  ["Quanto é o sinal?", "humano"],
  ["Quero marcar", "humano"],
  ["Pode agendar", "humano"],
  ["Quero fechar", "humano"],
  ["Me passa o contato", "humano"],
  ["Quero falar com o Coringa", "humano"],
  ["Tenho interesse", "novo"],
  ["Gostei", "novo"],
  ["Pode ser", "novo"],
  ["Fechado", "humano"],
  ["Vou pensar", "novo"],
  ["Está caro", "novo"],
  ["Tem horário?", "agendamento"],
  ["Qual dia tem?", "agendamento"]
];

for (const [input, expectedStage] of characterizationMatrix) {
  test(`caracteriza: ${input}`, () => {
    const actualStage = detectarStage(input);
    assert.equal(actualStage, expectedStage);
    assert.equal(actualStage === "humano", expectedStage === "humano");
  });
}

test("entrada sem regra preserva o stage existente", () => {
  assert.equal(detectarStage("Gostei", "orcamento"), "orcamento");
});

test("CASE-001 Allef preserva orçamento sem handoff após a correção", () => {
  let finalStage = null;

  for (const step of CASE_001_ALLEF.steps) {
    finalStage = detectarStage(step.input, step.existingStage);
    assert.equal(finalStage, step.expectedStage, `${step.input}: stage divergente`);
  }

  assert.equal(finalStage, "orcamento");
  assert.equal(finalStage === "humano", CASE_001_ALLEF.expectedHandoff);
});
