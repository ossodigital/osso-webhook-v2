import test from "node:test";
import assert from "node:assert/strict";
import { montarPromptSistema } from "../../services/ai/prompts.js";

test("prompt legado permanece sem bloco piloto quando contexto está ausente", () => {
  const prompt = montarPromptSistema("Ana");
  assert.ok(!prompt.includes("CONTEXTO ESTRUTURADO DO PILOTO"));
});

test("prompt piloto adiciona regras sem substituir o prompt base", () => {
  const prompt = montarPromptSistema("Ana", { decisionContext: {
    knownFacts: ["NAME"],
    blockedFacts: ["NAME"],
    nextFact: "SIZE",
    currentIntent: [],
    salesObjective: "QUALIFY_PROJECT",
    contextDecision: "ASK_NEXT_FACT",
    shouldAsk: true,
    pricingStatus: "INSUFFICIENT_DATA",
    pricingEstimate: null,
    objection: null,
    waiting: false,
    humanRequest: false
  }});
  assert.match(prompt, /Você é o atendimento oficial/);
  assert.match(prompt, /CONTEXTO ESTRUTURADO DO PILOTO/);
  assert.match(prompt, /no máximo uma pergunta relevante/);
  assert.match(prompt, /não crie handoff automático/);
});
