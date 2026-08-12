import test from "node:test";
import assert from "node:assert/strict";
import { classifyObjection, OBJECTION_TYPES } from "../../modules/sales/objectionEngine.js";

const cases = [
  ["Está caro", OBJECTION_TYPES.PRICE, "EXPLAIN_VALUE"],
  ["Tem desconto?", OBJECTION_TYPES.DISCOUNT, "CLARIFY_SCOPE"],
  ["Outro tatuador faz mais barato", OBJECTION_TYPES.COMPARISON, "EXPLAIN_VALUE"],
  ["Tenho medo da dor", OBJECTION_TYPES.PAIN, "EXPLAIN_PROCESS"],
  ["Demora muito", OBJECTION_TYPES.TIME, "CLARIFY_SCOPE"],
  ["Vou pensar", OBJECTION_TYPES.INDECISION, "WAIT"],
  ["Consigo parcelar?", OBJECTION_TYPES.PAYMENT, "DISCUSS_PAYMENT_OPTIONS"]
];

for (const [text, type, strategy] of cases) {
  test(`classifica objeção ${type}`, () => {
    const result = classifyObjection({ text });
    assert.equal(result.hasObjection, true);
    assert.equal(result.type, type);
    assert.equal(result.recommendedStrategy, strategy);
    assert.equal("reply" in result, false);
  });
}

test("mensagem neutra não cria objeção", () => {
  assert.deepEqual(classifyObjection({ text: "Gostei" }), {
    hasObjection: false,
    type: null,
    confidence: null,
    signals: [],
    recommendedStrategy: null
  });
});

test("objeção genérica explícita usa OTHER", () => {
  const result = classifyObjection({ text: "Tenho uma preocupação" });
  assert.equal(result.type, OBJECTION_TYPES.OTHER);
  assert.equal(result.confidence, "medium");
  assert.equal(result.recommendedStrategy, "HUMAN_REVIEW");
});

test("objeção composta preserva todos os sinais e prioridade", () => {
  const result = classifyObjection({ text: "Outro tatuador faz mais barato, mas está caro" });
  assert.equal(result.type, OBJECTION_TYPES.COMPARISON);
  assert.deepEqual(result.signals, [OBJECTION_TYPES.COMPARISON, OBJECTION_TYPES.PRICE]);
});
