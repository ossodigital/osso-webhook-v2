import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_DOWNLOAD_STATUS,
  AUDIO_TRANSCRIPTION_STATUS,
  buildAudioContext,
  getSafeAudioTranscript,
  isRetryableAudioError
} from "../../modules/audio/audioContext.js";
import { classifySignals } from "../../modules/conversation/signalClassifier.js";
import { collectFacts } from "../../modules/qualification/collectedFacts.js";
import detectarStage from "../../modules/stages/stageDetector.js";

function failedAudioContext() {
  return buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.FAILED,
    error: { status: 503, message: "temporary transcription service error" }
  });
}

function successfulAudioContext(transcript) {
  return buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.SUCCESS,
    transcript
  });
}

test("política pura separa erros retryable e non-retryable", () => {
  assert.equal(isRetryableAudioError({ name: "TimeoutError" }), true);
  assert.equal(isRetryableAudioError({ status: 503 }), true);
  assert.equal(isRetryableAudioError({ status: 429 }), true);
  assert.equal(isRetryableAudioError({ code: "EMPTY_FILE" }), false);
  assert.equal(isRetryableAudioError({ code: "UNSUPPORTED_FORMAT" }), false);
  assert.equal(isRetryableAudioError({ message: "invalid media" }), false);
});

test("AUDIO-006: falha de áudio preserva lead anterior em orçamento", () => {
  const text = getSafeAudioTranscript(failedAudioContext());
  const signals = classifySignals({ text, previousStage: "orcamento" });
  const facts = collectFacts({ text, signals });

  assert.equal(text, null);
  assert.deepEqual(signals.categories, []);
  assert.equal(facts.tattooIntent.value, false);
  assert.equal(facts.buyingSignals.value, null);
  assert.equal(detectarStage(text, "orcamento"), "orcamento");
});

test("AUDIO-007: falha de áudio preserva lead anterior em agendamento", () => {
  const text = getSafeAudioTranscript(failedAudioContext());
  assert.equal(text, null);
  assert.equal(detectarStage(text, "agendamento"), "agendamento");
});

test("AUDIO-008: transcrição quero fechar permanece texto real e classificável", () => {
  const text = getSafeAudioTranscript(successfulAudioContext("quero fechar"));
  assert.equal(text, "quero fechar");
  assert.equal(detectarStage(text, "novo"), "humano");
});

test("AUDIO-009: transcrição de espera permanece texto real sem síntese", () => {
  const text = getSafeAudioTranscript(successfulAudioContext("vou pensar e te aviso"));
  assert.equal(text, "vou pensar e te aviso");
  assert.notEqual(text, "quero fazer uma tatuagem");
});

test("AUDIO-010: texto normal de tattoo só é liberado após sucesso", () => {
  const text = getSafeAudioTranscript(successfulAudioContext("Quero fazer uma tattoo de flor pequena no antebraço"));
  const facts = collectFacts({ text });

  assert.equal(text, "Quero fazer uma tattoo de flor pequena no antebraço");
  assert.equal(facts.tattooIntent.value, true);
  assert.equal(facts.bodyLocation.value, "antebraço");
});

test("downstream safety: contexto inseguro não fornece texto a nenhuma camada futura", () => {
  const text = getSafeAudioTranscript(failedAudioContext());
  const futureConsumers = [
    "Signals", "Facts", "Stage", "Lead Score", "Sales Strategy", "Pricing", "Handoff"
  ];

  assert.equal(text, null);
  for (const consumer of futureConsumers) {
    assert.equal(text, null, `${consumer} não deve receber texto de falha técnica`);
  }
});
