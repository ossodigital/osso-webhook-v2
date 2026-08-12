export const IMAGE_SOURCES = Object.freeze({
  IMAGE_OBSERVATION: "image_observation",
  MODEL_INFERENCE: "model_inference"
});

export const IMAGE_CONFIDENCE = Object.freeze({ LOW: "low", MEDIUM: "medium", HIGH: "high" });

const FIELD_NAMES = Object.freeze([
  "tattooStyle", "bodyPlacementShown", "composition", "colorProfile",
  "complexity", "approximateScale", "coverageType"
]);

const emptyField = () => ({ value: null, confidence: null, source: null });
const cleanList = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))]
  : [];

function sanitizeField(value) {
  if (!value || typeof value !== "object" || typeof value.value !== "string" || !value.value.trim()) return emptyField();
  const source = Object.values(IMAGE_SOURCES).includes(value.source) ? value.source : IMAGE_SOURCES.MODEL_INFERENCE;
  const requestedConfidence = Object.values(IMAGE_CONFIDENCE).includes(value.confidence) ? value.confidence : IMAGE_CONFIDENCE.LOW;
  const confidence = source === IMAGE_SOURCES.MODEL_INFERENCE && requestedConfidence === IMAGE_CONFIDENCE.HIGH
    ? IMAGE_CONFIDENCE.MEDIUM
    : requestedConfidence;
  return { value: value.value.trim(), confidence, source };
}

export function createEmptyImageContext() {
  return {
    hasReference: false,
    ...Object.fromEntries(FIELD_NAMES.map((key) => [key, emptyField()])),
    visualElements: [],
    observations: [],
    uncertainties: [],
    copyIntent: null
  };
}

export function buildImageContext({ hasImage = false, analysis = null } = {}) {
  const context = createEmptyImageContext();
  if (!hasImage) return context;
  context.hasReference = true;
  if (!analysis || typeof analysis !== "object") {
    context.uncertainties.push("image_analysis_unavailable");
    return context;
  }
  for (const key of FIELD_NAMES) context[key] = sanitizeField(analysis[key]);
  context.visualElements = cleanList(analysis.visualElements);
  context.observations = cleanList(analysis.observations);
  context.uncertainties = cleanList(analysis.uncertainties);
  if (!context.uncertainties.length && FIELD_NAMES.every((key) => context[key].value === null) && !context.visualElements.length) {
    context.uncertainties.push("insufficient_visual_information");
  }
  return context;
}
