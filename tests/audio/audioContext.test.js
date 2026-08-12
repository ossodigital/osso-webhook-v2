import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_DOWNLOAD_STATUS,
  AUDIO_ERROR_CODES,
  AUDIO_SOURCES,
  AUDIO_TRANSCRIPTION_STATUS,
  buildAudioContext,
  createEmptyAudioContext,
  getSafeAudioTranscript
} from "../../modules/audio/audioContext.js";

test("audio ausente mantém contrato vazio e não conversacional", () => {
  assert.deepEqual(buildAudioContext(), createEmptyAudioContext());
  assert.equal(getSafeAudioTranscript(buildAudioContext()), null);
});

test("AUDIO-001: transcrição válida é segura para conversa", () => {
  const context = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    declaredMimeType: "audio/ogg",
    detectedMimeType: "audio/ogg",
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.SUCCESS,
    transcript: "Quero uma tattoo no braço",
    source: AUDIO_SOURCES.AZURE
  });

  assert.equal(context.safeForConversation, true);
  assert.equal(context.transcript, "Quero uma tattoo no braço");
  assert.equal(context.errorCode, null);
  assert.equal(context.retryable, false);
  assert.equal(getSafeAudioTranscript(context), "Quero uma tattoo no braço");
});

test("AUDIO-002: falha temporária de download não fabrica mensagem", () => {
  const context = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.FAILED,
    declaredMimeType: "audio/ogg",
    error: { name: "TimeoutError", message: "download timed out" },
    source: AUDIO_SOURCES.META
  });

  assert.equal(context.transcriptionStatus, AUDIO_TRANSCRIPTION_STATUS.NOT_ATTEMPTED);
  assert.equal(context.transcript, null);
  assert.equal(context.errorCode, AUDIO_ERROR_CODES.DOWNLOAD_FAILED);
  assert.equal(context.retryable, true);
  assert.equal(context.safeForConversation, false);
  assert.equal(getSafeAudioTranscript(context), null);
});

test("AUDIO-003: falha temporária do Azure é retryable sem loop automático", () => {
  const context = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.FAILED,
    error: { status: 429, message: "rate limit" },
    source: AUDIO_SOURCES.AZURE
  });

  assert.equal(context.transcript, null);
  assert.equal(context.errorCode, AUDIO_ERROR_CODES.TRANSCRIPTION_FAILED);
  assert.equal(context.retryable, true);
  assert.equal(context.safeForConversation, false);
});

test("AUDIO-004: transcrição vazia é non-retryable e nunca usa fallback sintético", () => {
  const context = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.SUCCESS,
    transcript: "   ",
    error: { code: "EMPTY_FILE", message: "empty transcription" }
  });

  assert.equal(context.transcriptionStatus, AUDIO_TRANSCRIPTION_STATUS.EMPTY);
  assert.equal(context.transcript, null);
  assert.equal(context.errorCode, AUDIO_ERROR_CODES.TRANSCRIPTION_EMPTY);
  assert.equal(context.retryable, false);
  assert.equal(getSafeAudioTranscript(context), null);
  assert.notEqual(context.transcript, "quero fazer uma tatuagem");
});

test("AUDIO-005: MIME declarado e detectado diferentes são preservados para auditoria", () => {
  const context = buildAudioContext({
    received: true,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.SUCCESS,
    declaredMimeType: "audio/mp4",
    detectedMimeType: "audio/aac",
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.UNSUPPORTED,
    error: { code: "UNSUPPORTED_FORMAT", message: "unsupported audio format" }
  });

  assert.equal(context.declaredMimeType, "audio/mp4");
  assert.equal(context.detectedMimeType, "audio/aac");
  assert.equal(context.errorCode, AUDIO_ERROR_CODES.UNSUPPORTED_FORMAT);
  assert.equal(context.retryable, false);
  assert.equal(context.safeForConversation, false);
});
