export const AUDIO_DOWNLOAD_STATUS = Object.freeze({
  NOT_ATTEMPTED: "NOT_ATTEMPTED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED"
});

export const AUDIO_TRANSCRIPTION_STATUS = Object.freeze({
  NOT_ATTEMPTED: "NOT_ATTEMPTED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  EMPTY: "EMPTY",
  UNSUPPORTED: "UNSUPPORTED"
});

export const AUDIO_ERROR_CODES = Object.freeze({
  DOWNLOAD_FAILED: "AUDIO_DOWNLOAD_FAILED",
  TRANSCRIPTION_FAILED: "AUDIO_TRANSCRIPTION_FAILED",
  TRANSCRIPTION_EMPTY: "AUDIO_TRANSCRIPTION_EMPTY",
  UNSUPPORTED_FORMAT: "AUDIO_UNSUPPORTED_FORMAT"
});

export const AUDIO_SOURCES = Object.freeze({
  META: "meta_audio",
  AZURE: "azure_transcription",
  SHADOW: "audio_shadow"
});

const RETRYABLE_ERROR_MARKERS = Object.freeze([
  "timeout", "timed out", "temporary", "temporario", "temporário",
  "rate limit", "too many requests", "download temporarily", "download temporar"
]);

const NON_RETRYABLE_ERROR_MARKERS = Object.freeze([
  "empty", "vazio", "unsupported", "nao suportado", "não suportado",
  "invalid media", "midia invalida", "mídia inválida", "invalid file"
]);

function errorText(error) {
  if (!error) return "";
  if (typeof error === "string") return error.toLowerCase();
  return [error.code, error.name, error.message, error.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isRetryableAudioError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  if (status === 429 || status >= 500) return true;
  if (status >= 400 && status < 500) return false;

  const text = errorText(error);
  if (!text || NON_RETRYABLE_ERROR_MARKERS.some((marker) => text.includes(marker))) return false;
  return RETRYABLE_ERROR_MARKERS.some((marker) => text.includes(marker));
}

export function createEmptyAudioContext() {
  return {
    received: false,
    downloadStatus: AUDIO_DOWNLOAD_STATUS.NOT_ATTEMPTED,
    declaredMimeType: null,
    detectedMimeType: null,
    transcriptionStatus: AUDIO_TRANSCRIPTION_STATUS.NOT_ATTEMPTED,
    transcript: null,
    errorCode: null,
    retryable: false,
    safeForConversation: false,
    source: null
  };
}

export function buildAudioContext({
  received = false,
  downloadStatus = AUDIO_DOWNLOAD_STATUS.NOT_ATTEMPTED,
  declaredMimeType = null,
  detectedMimeType = null,
  transcriptionStatus = AUDIO_TRANSCRIPTION_STATUS.NOT_ATTEMPTED,
  transcript = null,
  error = null,
  errorCode = null,
  source = AUDIO_SOURCES.SHADOW
} = {}) {
  if (!received) return createEmptyAudioContext();

  const cleanTranscript = typeof transcript === "string" && transcript.trim()
    ? transcript.trim()
    : null;

  let normalizedTranscriptionStatus = transcriptionStatus;
  if (transcriptionStatus === AUDIO_TRANSCRIPTION_STATUS.SUCCESS && !cleanTranscript) {
    normalizedTranscriptionStatus = AUDIO_TRANSCRIPTION_STATUS.EMPTY;
  }

  const failedDownload = downloadStatus === AUDIO_DOWNLOAD_STATUS.FAILED;
  const safeForConversation = !failedDownload &&
    normalizedTranscriptionStatus === AUDIO_TRANSCRIPTION_STATUS.SUCCESS &&
    cleanTranscript !== null;

  const defaultErrorCode = failedDownload
    ? AUDIO_ERROR_CODES.DOWNLOAD_FAILED
    : normalizedTranscriptionStatus === AUDIO_TRANSCRIPTION_STATUS.EMPTY
      ? AUDIO_ERROR_CODES.TRANSCRIPTION_EMPTY
      : normalizedTranscriptionStatus === AUDIO_TRANSCRIPTION_STATUS.UNSUPPORTED
        ? AUDIO_ERROR_CODES.UNSUPPORTED_FORMAT
        : normalizedTranscriptionStatus === AUDIO_TRANSCRIPTION_STATUS.FAILED
          ? AUDIO_ERROR_CODES.TRANSCRIPTION_FAILED
          : null;

  return {
    received: true,
    downloadStatus,
    declaredMimeType: declaredMimeType || null,
    detectedMimeType: detectedMimeType || null,
    transcriptionStatus: failedDownload
      ? AUDIO_TRANSCRIPTION_STATUS.NOT_ATTEMPTED
      : normalizedTranscriptionStatus,
    transcript: safeForConversation ? cleanTranscript : null,
    errorCode: safeForConversation ? null : (errorCode || defaultErrorCode),
    retryable: safeForConversation ? false : isRetryableAudioError(error),
    safeForConversation,
    source: source || AUDIO_SOURCES.SHADOW
  };
}

export function getSafeAudioTranscript(audioContext) {
  if (audioContext?.safeForConversation !== true) return null;
  if (audioContext?.transcriptionStatus !== AUDIO_TRANSCRIPTION_STATUS.SUCCESS) return null;
  return typeof audioContext.transcript === "string" && audioContext.transcript.trim()
    ? audioContext.transcript.trim()
    : null;
}
