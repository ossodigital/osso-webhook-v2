import test from "node:test";
import assert from "node:assert/strict";
import { classifySignals } from "../../modules/conversation/signalClassifier.js";
import { collectFacts, createEmptyFacts } from "../../modules/qualification/collectedFacts.js";
import { calculateLeadScore, LEAD_LEVELS, levelForScore } from "../../modules/sales/leadScoring.js";
import { buildConversationState } from "../../services/ai/conversationState.js";

function stateFor(text, options = {}) {
  return buildConversationState({ text, currentStage: options.currentStage || "novo", ...options });
}

test("score vazio é frio e auditável", () => {
  const result = calculateLeadScore({ facts: createEmptyFacts(), signals: classifySignals({ text: "" }) });
  assert.deepEqual(result, { score: 0, level: LEAD_LEVELS.COLD, breakdown: [] });
});

test("pontua intenção, local, tamanho e primeira tattoo", () => {
  const result = calculateLeadScore(stateFor("Minha primeira tattoo será no braço com 12 cm"));
  assert.equal(result.score, 24);
  assert.deepEqual(result.breakdown.map((item) => item.signal), ["tattooIntent", "bodyLocation", "approximateSize", "firstTattoo"]);
});

test("referência com imagem não duplica a mesma ação", () => {
  const result = calculateLeadScore(stateFor("cliente enviou imagem de referência de tattoo"));
  assert.ok(result.breakdown.some((item) => item.signal === "referenceReceived"));
  assert.ok(!result.breakdown.some((item) => item.signal === "imageReceived"));
});

test("imagem sem referência recebe somente peso de imagem", () => {
  const facts = createEmptyFacts();
  facts.imageReceived = { value: true, confidence: "high", source: "media_context" };
  const result = calculateLeadScore({ facts, signals: classifySignals({ text: "imagem recebida" }) });
  assert.equal(result.score, 5);
});

test("pergunta de preço e estimativa apresentada são explicadas separadamente", () => {
  const result = calculateLeadScore(stateFor("Quanto fica? A estimativa mencionada foi R$ 800"));
  assert.ok(result.breakdown.some((item) => item.signal === "priceInquiry"));
  assert.ok(result.breakdown.some((item) => item.signal === "estimatedPrice"));
});

test("pergunta de duração é moderada sem inventar horas", () => {
  const state = stateFor("Quanto tempo demora?");
  const result = calculateLeadScore(state);
  assert.equal(result.score, 5);
  assert.equal(state.facts.estimatedHours.value, null);
});

test("agenda, pagamento e reserva não duplicam a mesma intenção", () => {
  const agenda = calculateLeadScore(stateFor("Quero agendar"));
  const payment = calculateLeadScore(stateFor("Quanto é o sinal?"));
  const reservation = calculateLeadScore(stateFor("Quero reservar uma data"));
  assert.equal(agenda.breakdown.filter((item) => /Intent$/.test(item.signal)).length, 1);
  assert.equal(payment.breakdown.filter((item) => /Intent$/.test(item.signal)).length, 1);
  assert.equal(reservation.breakdown.filter((item) => /Intent$/.test(item.signal)).length, 1);
});

test("human request não aumenta score", () => {
  assert.equal(calculateLeadScore(stateFor("Quero falar com o Coringa")).score, 0);
});

for (const objection of ["Está caro", "Vou pensar", "Outro tatuador faz mais barato", "Tenho medo da dor"]) {
  test(`objeção não reduz score: ${objection}`, () => {
    const previousFacts = collectFacts({ text: "Quero fazer uma tattoo no braço" });
    const baseline = calculateLeadScore(stateFor("Oi", { previousFacts })).score;
    const withObjection = calculateLeadScore(stateFor(objection, { previousFacts })).score;
    assert.equal(withObjection, baseline);
  });
}

test("waiting não altera score dos mesmos fatos", () => {
  const previousFacts = collectFacts({ text: "Quero fazer uma tattoo no braço" });
  const active = stateFor("Oi", { previousFacts });
  const waiting = stateFor("Vou pensar", { previousFacts });
  assert.equal(waiting.waitingForCustomer, true);
  assert.equal(calculateLeadScore(waiting).score, calculateLeadScore(active).score);
});

test("score fica entre 0 e 100 e breakdown soma exatamente o score", () => {
  const facts = collectFacts({
    text: "Minha primeira tattoo fineline no braço terá 15 cm, R$ 900 e 5 horas. Quero pagar o sinal",
    history: [{ role: "user", content: "cliente enviou imagem de referência de tattoo" }]
  });
  const state = { facts, signals: classifySignals({ text: "Quanto fica? Quero reservar uma data" }) };
  const result = calculateLeadScore(state);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.breakdown.reduce((sum, item) => sum + item.points, 0), result.score);
});

test("levels respeitam limites documentados", () => {
  assert.equal(levelForScore(0), LEAD_LEVELS.COLD);
  assert.equal(levelForScore(20), LEAD_LEVELS.WARM);
  assert.equal(levelForScore(40), LEAD_LEVELS.HOT);
  assert.equal(levelForScore(70), LEAD_LEVELS.VERY_HOT);
  assert.equal(levelForScore(100), LEAD_LEVELS.VERY_HOT);
});

test("contrato não contém decisão de handoff", () => {
  const result = calculateLeadScore(stateFor("Quanto é o sinal?"));
  assert.deepEqual(Object.keys(result), ["score", "level", "breakdown"]);
  assert.equal("shouldHandoff" in result, false);
});
