import { FACT_SOURCE_PRECEDENCE } from "../qualification/collectedFacts.js";

export const LEAD_MEMORY_VERSION = 1;

export const MEMORY_SOURCES = Object.freeze({
  CUSTOMER_EXPLICIT: "customer_explicit",
  CUSTOMER_CONFIRMED: "customer_confirmed",
  EXISTING_FACT: "existing_fact",
  IMAGE_OBSERVATION: "image_observation",
  MODEL_INFERENCE: "model_inference"
});

export const MEMORY_SOURCE_PRECEDENCE = Object.freeze({ ...FACT_SOURCE_PRECEDENCE });

const QUALIFICATION_FIELDS = Object.freeze([
  "identity.name",
  "tattoo.intent",
  "tattoo.referenceReceived",
  "tattoo.style",
  "tattoo.bodyLocation",
  "tattoo.size",
  "tattoo.firstTattoo"
]);

const SOURCE_ALIASES = Object.freeze({
  customer_message: MEMORY_SOURCES.CUSTOMER_EXPLICIT,
  explicit_conversation_value: MEMORY_SOURCES.CUSTOMER_EXPLICIT,
  customer_explicit: MEMORY_SOURCES.CUSTOMER_EXPLICIT,
  customer_confirmed: MEMORY_SOURCES.CUSTOMER_CONFIRMED,
  lead_context: MEMORY_SOURCES.CUSTOMER_CONFIRMED,
  existing_fact: MEMORY_SOURCES.EXISTING_FACT,
  image_observation: MEMORY_SOURCES.IMAGE_OBSERVATION,
  media_context: MEMORY_SOURCES.IMAGE_OBSERVATION,
  model_inference: MEMORY_SOURCES.MODEL_INFERENCE,
  conversation_analysis: MEMORY_SOURCES.MODEL_INFERENCE,
  signal_classifier: MEMORY_SOURCES.MODEL_INFERENCE
});

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const cleanList = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))]
  : [];

export function createEmptyLeadMemory() {
  return {
    version: LEAD_MEMORY_VERSION,
    identity: { name: null },
    tattoo: {
      intent: null,
      referenceReceived: false,
      referenceSummary: null,
      style: null,
      bodyLocation: null,
      size: null,
      firstTattoo: null,
      coverage: null,
      elements: [],
      notes: []
    },
    commercial: {
      quotedPrice: null,
      quotedPriceType: null,
      estimatedHours: null,
      estimatedSessions: null,
      signalAmountDiscussed: null,
      paymentDiscussed: false,
      schedulingIntent: false,
      buyingIntent: false
    },
    objections: [],
    conversation: {
      waitingForCustomer: false,
      humanRequested: false,
      lastObjective: null,
      lastStage: null
    },
    provenance: {},
    updatedAt: null
  };
}

function normalizeMemory(previousMemory) {
  const empty = createEmptyLeadMemory();
  if (!previousMemory || typeof previousMemory !== "object") return empty;
  return {
    ...empty,
    ...clone(previousMemory),
    version: LEAD_MEMORY_VERSION,
    identity: { ...empty.identity, ...clone(previousMemory.identity) },
    tattoo: {
      ...empty.tattoo,
      ...clone(previousMemory.tattoo),
      elements: cleanList(previousMemory.tattoo?.elements),
      notes: cleanList(previousMemory.tattoo?.notes)
    },
    commercial: { ...empty.commercial, ...clone(previousMemory.commercial) },
    objections: cleanList(previousMemory.objections),
    conversation: { ...empty.conversation, ...clone(previousMemory.conversation) },
    provenance: clone(previousMemory.provenance) || {}
  };
}

function normalizeSource(source) {
  return SOURCE_ALIASES[source] || MEMORY_SOURCES.MODEL_INFERENCE;
}

function getAtPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setAtPath(object, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const parent = keys.reduce((current, key) => current[key], object);
  parent[lastKey] = value;
}

function canReplace(memory, path, source) {
  const currentValue = getAtPath(memory, path);
  if (currentValue === null || currentValue === undefined || currentValue === false) return true;
  const currentSource = memory.provenance[path]?.source || MEMORY_SOURCES.EXISTING_FACT;
  return MEMORY_SOURCE_PRECEDENCE[source] >= MEMORY_SOURCE_PRECEDENCE[currentSource];
}

function remember(memory, path, value, source, confidence = null) {
  if (value === null || value === undefined || value === "") return;
  const normalizedSource = normalizeSource(source);
  if (!canReplace(memory, path, normalizedSource)) return;
  setAtPath(memory, path, clone(value));
  memory.provenance[path] = { source: normalizedSource, confidence: confidence || null };
}

function rememberFact(memory, path, fact, { truthyOnly = false, explicitOnly = false } = {}) {
  if (!fact || fact.value === null || fact.value === undefined) return;
  if (truthyOnly && fact.value !== true) return;
  const source = normalizeSource(fact.source);
  if (explicitOnly && ![MEMORY_SOURCES.CUSTOMER_EXPLICIT, MEMORY_SOURCES.CUSTOMER_CONFIRMED].includes(source)) return;
  remember(memory, path, fact.value, source, fact.confidence);
}

function appendUnique(memory, path, values, source, confidence = null) {
  const additions = cleanList(values);
  if (!additions.length) return;
  const merged = [...new Set([...cleanList(getAtPath(memory, path)), ...additions])];
  setAtPath(memory, path, merged);
  memory.provenance[path] = { source: normalizeSource(source), confidence: confidence || null };
}

function hasCustomerInteraction(conversationState) {
  return typeof conversationState?.signals?.text === "string" && conversationState.signals.text.trim().length > 0;
}

export function mergeLeadMemory(previousMemory = null, conversationState = {}) {
  const memory = normalizeMemory(previousMemory);
  if (conversationState?.audioContext?.received && conversationState.audioContext.safeForConversation !== true) {
    return memory;
  }

  const facts = conversationState?.facts || {};
  const image = conversationState?.imageContext || {};

  rememberFact(memory, "identity.name", facts.name);
  rememberFact(memory, "tattoo.intent", facts.tattooIntent, { truthyOnly: true });
  rememberFact(memory, "tattoo.referenceReceived", facts.referenceReceived, { truthyOnly: true });
  rememberFact(memory, "tattoo.style", facts.tattooStyle);
  rememberFact(memory, "tattoo.bodyLocation", facts.bodyLocation);
  rememberFact(memory, "tattoo.size", facts.approximateSize);
  rememberFact(memory, "tattoo.firstTattoo", facts.firstTattoo);

  rememberFact(memory, "commercial.quotedPrice", facts.estimatedPrice, { explicitOnly: true });
  if (memory.commercial.quotedPrice !== null && facts.estimatedPrice?.value !== null && facts.estimatedPrice?.value !== undefined) {
    remember(memory, "commercial.quotedPriceType", "explicit_conversation_value", facts.estimatedPrice.source, facts.estimatedPrice.confidence);
  }
  rememberFact(memory, "commercial.estimatedHours", facts.estimatedHours, { explicitOnly: true });
  rememberFact(memory, "commercial.paymentDiscussed", facts.paymentIntent, { truthyOnly: true });
  rememberFact(memory, "commercial.schedulingIntent", facts.schedulingIntent, { truthyOnly: true });
  if (Array.isArray(facts.buyingSignals?.value) && facts.buyingSignals.value.length) {
    remember(memory, "commercial.buyingIntent", true, facts.buyingSignals.source, facts.buyingSignals.confidence);
  }

  appendUnique(memory, "objections", facts.objections?.value, facts.objections?.source, facts.objections?.confidence);

  if (image.hasReference) {
    remember(memory, "tattoo.referenceReceived", true, MEMORY_SOURCES.IMAGE_OBSERVATION, "high");
    const summary = cleanList(image.observations).join("; ");
    if (summary) remember(memory, "tattoo.referenceSummary", summary, MEMORY_SOURCES.IMAGE_OBSERVATION, "medium");
  }
  remember(memory, "tattoo.coverage", image.coverageType?.value, image.coverageType?.source, image.coverageType?.confidence);
  appendUnique(memory, "tattoo.elements", image.visualElements, MEMORY_SOURCES.IMAGE_OBSERVATION, "medium");
  appendUnique(memory, "tattoo.notes", image.observations, MEMORY_SOURCES.IMAGE_OBSERVATION, "medium");

  if (conversationState.waitingForCustomer === true) {
    remember(memory, "conversation.waitingForCustomer", true, MEMORY_SOURCES.CUSTOMER_EXPLICIT, "high");
  } else if (hasCustomerInteraction(conversationState)) {
    setAtPath(memory, "conversation.waitingForCustomer", false);
    memory.provenance["conversation.waitingForCustomer"] = {
      source: MEMORY_SOURCES.CUSTOMER_EXPLICIT,
      confidence: "high"
    };
  }
  rememberFact(memory, "conversation.humanRequested", facts.humanRequest, { truthyOnly: true });
  remember(memory, "conversation.lastObjective", conversationState.objective, MEMORY_SOURCES.MODEL_INFERENCE);
  remember(memory, "conversation.lastStage", conversationState.currentStage, MEMORY_SOURCES.EXISTING_FACT);

  memory.updatedAt = conversationState.updatedAt ?? memory.updatedAt;
  return memory;
}

export function getMissingQualification(memory = null) {
  const normalized = normalizeMemory(memory);
  return QUALIFICATION_FIELDS.filter((path) => {
    const value = getAtPath(normalized, path);
    return value === null || value === undefined || value === false || value === "";
  });
}
