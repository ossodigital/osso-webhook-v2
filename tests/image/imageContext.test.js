import test from "node:test";
import assert from "node:assert/strict";
import { buildImageContext, createEmptyImageContext, IMAGE_SOURCES } from "../../modules/image/imageContext.js";
import { collectFacts, FACT_SOURCE_PRECEDENCE } from "../../modules/qualification/collectedFacts.js";
import { buildConversationState } from "../../services/ai/conversationState.js";

const probableAnalysis = {
  tattooStyle: { value: "black and grey / realismo", confidence: "medium", source: IMAGE_SOURCES.MODEL_INFERENCE },
  bodyPlacementShown: { value: "antebraço", confidence: "medium", source: IMAGE_SOURCES.IMAGE_OBSERVATION },
  composition: { value: "vertical", confidence: "medium", source: IMAGE_SOURCES.IMAGE_OBSERVATION },
  visualElements: ["figura religiosa", "sombreamento"],
  colorProfile: { value: "preto e cinza", confidence: "high", source: IMAGE_SOURCES.IMAGE_OBSERVATION },
  complexity: { value: "alta", confidence: "low", source: IMAGE_SOURCES.MODEL_INFERENCE },
  approximateScale: { value: "grande", confidence: "low", source: IMAGE_SOURCES.MODEL_INFERENCE },
  coverageType: { value: "peça única", confidence: "low", source: IMAGE_SOURCES.MODEL_INFERENCE },
  observations: ["contraste em tons de cinza"],
  uncertainties: ["local desejado não pode ser deduzido da referência"]
};

test("ausência de imagem mantém contrato vazio e desconhecido", () => {
  assert.deepEqual(buildImageContext(), createEmptyImageContext());
});

test("imagem existente sem análise registra referência e incerteza", () => {
  const context = buildImageContext({ hasImage: true });
  assert.equal(context.hasReference, true);
  assert.equal(context.tattooStyle.value, null);
  assert.deepEqual(context.uncertainties, ["image_analysis_unavailable"]);
});

test("análise parcial preserva desconhecidos como null", () => {
  const context = buildImageContext({ hasImage: true, analysis: { visualElements: ["flor"] } });
  assert.deepEqual(context.visualElements, ["flor"]);
  assert.equal(context.bodyPlacementShown.value, null);
  assert.equal(context.approximateScale.value, null);
});

test("estilo provável e local mostrado permanecem incertos e separados", () => {
  const context = buildImageContext({ hasImage: true, analysis: probableAnalysis });
  assert.equal(context.tattooStyle.value, "black and grey / realismo");
  assert.equal(context.tattooStyle.confidence, "medium");
  assert.equal(context.bodyPlacementShown.value, "antebraço");
});

test("inferência de modelo nunca é elevada automaticamente a high", () => {
  const context = buildImageContext({ hasImage: true, analysis: {
    tattooStyle: { value: "realismo", confidence: "high", source: IMAGE_SOURCES.MODEL_INFERENCE }
  } });
  assert.equal(context.tattooStyle.confidence, "medium");
});

test("imagem preenche somente estilo observacional quando falta", () => {
  const imageContext = buildImageContext({ hasImage: true, analysis: probableAnalysis });
  const facts = collectFacts({ imageContext });
  assert.equal(facts.referenceReceived.value, true);
  assert.equal(facts.imageReceived.value, true);
  assert.equal(facts.tattooStyle.source, IMAGE_SOURCES.MODEL_INFERENCE);
  assert.equal(facts.bodyLocation.value, null);
});

test("cliente contradiz local mostrado e local desejado continua sendo o do cliente", () => {
  const imageContext = buildImageContext({ hasImage: true, analysis: probableAnalysis });
  const facts = collectFacts({ text: "Quero fazer na panturrilha", imageContext });
  assert.equal(facts.bodyLocation.value, "panturrilha");
  assert.equal(facts.bodyLocation.source, "customer_explicit");
  assert.equal(imageContext.bodyPlacementShown.value, "antebraço");
});

test("estilo explícito do cliente vence inferência visual", () => {
  const imageContext = buildImageContext({ hasImage: true, analysis: probableAnalysis });
  const facts = collectFacts({ text: "Quero em blackwork", imageContext });
  assert.equal(facts.tattooStyle.value, "blackwork");
  assert.equal(facts.tattooStyle.source, "customer_explicit");
});

test("previousFacts são preservados contra observação de imagem", () => {
  const previousFacts = collectFacts({ text: "Quero em blackwork na coxa" });
  const imageContext = buildImageContext({ hasImage: true, analysis: probableAnalysis });
  const facts = collectFacts({ previousFacts, imageContext });
  assert.equal(facts.tattooStyle.value, "blackwork");
  assert.equal(facts.bodyLocation.value, "coxa");
});

test("precedência documentada mantém cliente acima da imagem", () => {
  assert.ok(FACT_SOURCE_PRECEDENCE.customer_explicit > FACT_SOURCE_PRECEDENCE.customer_confirmed);
  assert.ok(FACT_SOURCE_PRECEDENCE.customer_confirmed > FACT_SOURCE_PRECEDENCE.existing_fact);
  assert.ok(FACT_SOURCE_PRECEDENCE.existing_fact > FACT_SOURCE_PRECEDENCE.image_observation);
  assert.ok(FACT_SOURCE_PRECEDENCE.image_observation > FACT_SOURCE_PRECEDENCE.model_inference);
});

test("imagem não cria preço, duração, sessões, buying signal ou handoff", () => {
  const state = buildConversationState({ hasImage: true, imageAnalysis: probableAnalysis });
  assert.equal(state.facts.estimatedPrice.value, null);
  assert.equal(state.facts.estimatedHours.value, null);
  assert.equal("estimatedSessions" in state.facts, false);
  assert.deepEqual(state.facts.buyingSignals.value, null);
  assert.equal(state.handoffCandidate.value, false);
});

test("referência visual não significa intenção de cópia", () => {
  const context = buildImageContext({ hasImage: true, analysis: probableAnalysis });
  assert.equal(context.copyIntent, null);
});
