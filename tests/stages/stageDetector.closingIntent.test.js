import test from "node:test";
import assert from "node:assert/strict";
import detectarStage from "../../modules/stages/stageDetector.js";

const contextosDeProjeto = [
  ["Braço fechado", "novo"],
  ["Manga fechada", "novo"],
  ["Quero fechar o braço", "quente"],
  ["Quero fazer o braço fechado", "quente"],
  ["Quero fechar um braço por fora sabe me ajudar?", "quente"],
  ["Quero fechar meu braço por fora", "quente"],
  ["Fechamento de braço", "novo"],
  ["Projeto de braço fechado", "novo"]
];

for (const [input, expectedStage] of contextosDeProjeto) {
  test(`não faz handoff em contexto de projeto: ${input}`, () => {
    const actualStage = detectarStage(input);
    assert.equal(actualStage, expectedStage);
    assert.notEqual(actualStage, "humano");
  });
}

const intencoesComerciais = [
  "Fechado",
  "Quero fechar",
  "Pode fechar",
  "Vamos fechar",
  "Quero fechar com vocês",
  "Quero fechar essa tattoo"
];

for (const input of intencoesComerciais) {
  test(`mantém handoff em intenção comercial: ${input}`, () => {
    assert.equal(detectarStage(input), "humano");
  });
}

test("classifica curiosidade explícita sem elevar intenção comercial", () => {
  assert.equal(detectarStage("Só estou pesquisando, sem compromisso"), "curioso");
  assert.equal(detectarStage("Só queria saber por curiosidade"), "curioso");
});
