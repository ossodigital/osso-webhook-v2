import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { buildImageContext, IMAGE_SOURCES } from "../../modules/image/imageContext.js";
import {
  AUDIO_DOWNLOAD_STATUS,
  AUDIO_TRANSCRIPTION_STATUS,
  buildAudioContext,
  getSafeAudioTranscript
} from "../../modules/audio/audioContext.js";
import {
  MEMORY_SOURCES,
  createEmptyLeadMemory,
  getMissingQualification,
  mergeLeadMemory
} from "../../modules/memory/leadMemory.js";

const stateFor = (text, options = {}) => buildConversationState({ text, currentStage: "novo", ...options });

test("MEM-001: memória vazia possui contrato versionado e nenhum fato inventado", () => {
  const memory = createEmptyLeadMemory();
  assert.equal(memory.version, 1);
  assert.equal(memory.identity.name, null);
  assert.equal(memory.tattoo.intent, null);
  assert.equal(memory.commercial.quotedPrice, null);
  assert.deepEqual(memory.provenance, {});
});

test("MEM-002: primeiro fato confiável entra com provenance", () => {
  const memory = mergeLeadMemory(null, stateFor("Meu nome é Ana"));
  assert.equal(memory.identity.name, "Ana");
  assert.equal(memory.provenance["identity.name"].source, MEMORY_SOURCES.CUSTOMER_EXPLICIT);
});

test("MEM-003: merge incremental acumula fatos confiáveis", () => {
  const first = mergeLeadMemory(null, stateFor("Quero fazer uma tattoo"));
  const second = mergeLeadMemory(first, stateFor("Quero no braço"));
  assert.equal(second.tattoo.intent, true);
  assert.equal(second.tattoo.bodyLocation, "braço");
});

test("MEM-004: null não apaga fato conhecido", () => {
  const known = mergeLeadMemory(null, stateFor("Quero em blackwork"));
  const next = mergeLeadMemory(known, stateFor("Oi"));
  assert.equal(next.tattoo.style, "blackwork");
});

test("MEM-005: declaração explícita do cliente vence observação de imagem", () => {
  const imageContext = buildImageContext({ hasImage: true, analysis: {
    tattooStyle: { value: "black and grey", confidence: "medium", source: IMAGE_SOURCES.IMAGE_OBSERVATION }
  }});
  const observed = mergeLeadMemory(null, stateFor("cliente enviou imagem", { imageContext }));
  const corrected = mergeLeadMemory(observed, stateFor("Quero em blackwork"));
  assert.equal(corrected.tattoo.style, "blackwork");
  assert.equal(corrected.provenance["tattoo.style"].source, MEMORY_SOURCES.CUSTOMER_EXPLICIT);
});

test("MEM-006: cliente pode corrigir explicitamente o local do corpo", () => {
  const first = mergeLeadMemory(null, stateFor("Vai ser no braço"));
  const corrected = mergeLeadMemory(first, stateFor("Na verdade quero fazer na panturrilha"));
  assert.equal(corrected.tattoo.bodyLocation, "panturrilha");
});

test("MEM-007: qualificação retorna somente fatos realmente ausentes", () => {
  let memory = mergeLeadMemory(null, stateFor("Meu nome é Ana"));
  memory = mergeLeadMemory(memory, stateFor("Quero fazer uma tattoo blackwork no braço"));
  memory = mergeLeadMemory(memory, stateFor("cliente enviou imagem de referência de tattoo"));
  assert.deepEqual(getMissingQualification(memory), ["tattoo.size", "tattoo.firstTattoo"]);
});

test("MEM-008: preço explicitamente informado pode ser lembrado", () => {
  const memory = mergeLeadMemory(null, stateFor("Fica R$850"));
  assert.equal(memory.commercial.quotedPrice, 850);
  assert.equal(memory.commercial.quotedPriceType, "explicit_conversation_value");
  assert.equal(memory.provenance["commercial.quotedPrice"].source, MEMORY_SOURCES.CUSTOMER_EXPLICIT);
});

test("MEM-009: preço inferido não vira preço confirmado", () => {
  const state = stateFor("Quero uma tattoo");
  state.facts.estimatedPrice = { value: 850, confidence: "low", source: "model_inference" };
  const memory = mergeLeadMemory(null, state);
  assert.equal(memory.commercial.quotedPrice, null);
});

test("MEM-010: waiting for customer é lembrado", () => {
  const memory = mergeLeadMemory(null, stateFor("Vou pensar e te aviso"));
  assert.equal(memory.conversation.waitingForCustomer, true);
});

test("MEM-011: retorno posterior encerra waiting e preserva fatos", () => {
  let memory = mergeLeadMemory(null, stateFor("Quero uma tattoo no braço"));
  memory = mergeLeadMemory(memory, stateFor("Vou pensar"));
  memory = mergeLeadMemory(memory, stateFor("Oi, quero marcar"));
  assert.equal(memory.conversation.waitingForCustomer, false);
  assert.equal(memory.tattoo.bodyLocation, "braço");
  assert.equal(memory.commercial.schedulingIntent, true);
});

test("MEM-012: humanRequested registra pedido sem decidir handoff", () => {
  const memory = mergeLeadMemory(null, stateFor("Quero falar com uma pessoa"));
  assert.equal(memory.conversation.humanRequested, true);
  assert.equal("handoff" in memory, false);
});

test("MEM-013: imagem contribui apenas com observações e provenance visual", () => {
  const imageContext = buildImageContext({ hasImage: true, analysis: {
    bodyPlacementShown: { value: "antebraço", confidence: "medium", source: IMAGE_SOURCES.IMAGE_OBSERVATION },
    coverageType: { value: "meia manga", confidence: "low", source: IMAGE_SOURCES.MODEL_INFERENCE },
    visualElements: ["flor"],
    observations: ["composição vertical"]
  }});
  const memory = mergeLeadMemory(null, stateFor("cliente enviou imagem", { imageContext }));
  assert.equal(memory.tattoo.referenceReceived, true);
  assert.equal(memory.tattoo.bodyLocation, null);
  assert.equal(memory.tattoo.coverage, "meia manga");
  assert.deepEqual(memory.tattoo.elements, ["flor"]);
});

test("MEM-014: áudio inseguro não altera memória", () => {
  const previous = mergeLeadMemory(null, stateFor("Meu nome é Ana"));
  const state = stateFor("quero fazer uma tatuagem");
  state.audioContext = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.FAILED,
    error: { message: "timeout" }
  });
  assert.deepEqual(mergeLeadMemory(previous, state), previous);
});

test("MEM-015: áudio válido pode fornecer fato downstream", () => {
  const audioContext = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.SUCCESS,
    transcript: "Quero fazer uma tattoo na coxa"
  });
  const text = getSafeAudioTranscript(audioContext);
  const state = stateFor(text);
  state.audioContext = audioContext;
  const memory = mergeLeadMemory(null, state);
  assert.equal(memory.tattoo.intent, true);
  assert.equal(memory.tattoo.bodyLocation, "coxa");
});

test("MEM-016: listas acumuladas não duplicam itens", () => {
  const state = stateFor("Está caro");
  const first = mergeLeadMemory(null, state);
  const second = mergeLeadMemory(first, state);
  assert.deepEqual(second.objections, ["Está caro"]);
});

test("MEM-017: previousMemory é preservada sem mutação", () => {
  const previous = mergeLeadMemory(null, stateFor("Quero fazer uma tattoo no braço"));
  const snapshot = JSON.stringify(previous);
  const next = mergeLeadMemory(previous, stateFor("Quero em blackwork"));
  assert.equal(JSON.stringify(previous), snapshot);
  assert.equal(next.tattoo.bodyLocation, "braço");
  assert.equal(next.tattoo.style, "blackwork");
});
