import { classifySignals, SIGNAL_CATEGORIES } from "../conversation/signalClassifier.js";

export const FACT_KEYS = Object.freeze([
  "name", "tattooIntent", "referenceReceived", "imageReceived", "audioReceived",
  "tattooStyle", "bodyLocation", "approximateSize", "firstTattoo", "estimatedHours",
  "estimatedPrice", "objections", "buyingSignals", "schedulingIntent", "paymentIntent",
  "humanRequest"
]);

export const FACT_SOURCE_PRECEDENCE = Object.freeze({
  model_inference: 1,
  image_observation: 2,
  existing_fact: 3,
  customer_confirmed: 4,
  customer_explicit: 5
});

const unknownFact = () => ({ value: null, confidence: null, source: null });
const knownFact = (value, confidence = "high", source = "customer_message") => ({ value, confidence, source });

export function createEmptyFacts() {
  return Object.fromEntries(FACT_KEYS.map((key) => [key, unknownFact()]));
}

export function hasKnownFact(facts, key) {
  const value = facts?.[key]?.value;
  return value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0);
}

function customerTexts(history, text) {
  const historical = (history || [])
    .filter((item) => !item?.role || item.role === "user")
    .map((item) => typeof item === "string" ? item : item?.content)
    .filter((item) => typeof item === "string" && item.trim());
  if (String(text || "").trim()) historical.push(String(text));
  return historical;
}

function lastMatch(texts, pattern, transform = (match) => match[0]) {
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const match = texts[index].match(pattern);
    if (match) return transform(match);
  }
  return null;
}

function mergePreviousFacts(previousFacts) {
  const facts = createEmptyFacts();
  for (const key of FACT_KEYS) {
    if (previousFacts?.[key] && hasKnownFact(previousFacts, key)) facts[key] = { ...previousFacts[key] };
  }
  return facts;
}

function imageFact(field) {
  if (!field?.value) return null;
  return knownFact(field.value, field.confidence || "low", field.source || "model_inference");
}

export function collectFacts({ text = "", history = [], signals = null, previousFacts = null, name = null, imageContext = null } = {}) {
  const facts = mergePreviousFacts(previousFacts);
  const texts = customerTexts(history, text);
  const joined = texts.join("\n").toLowerCase();
  const classifications = texts.map((item) => classifySignals({ text: item }));
  if (signals) classifications.push(signals);
  const categories = new Set(classifications.flatMap((item) => item?.categories || []));

  if (imageContext?.hasReference) {
    facts.referenceReceived = knownFact(true, "high", "image_observation");
    facts.imageReceived = knownFact(true, "high", "image_observation");
  }
  if (!hasKnownFact(facts, "tattooStyle")) {
    const observedStyle = imageFact(imageContext?.tattooStyle);
    if (observedStyle) facts.tattooStyle = observedStyle;
  }

  const explicitName = name || lastMatch(texts, /(?:meu nome [eé]|me chamo|pode me chamar de|me chama de)\s+([\p{L}'-]+(?:\s+[\p{L}'-]+)?)/iu, (match) => match[1]);
  if (explicitName) facts.name = knownFact(String(explicitName).trim(), "high", name ? "lead_context" : "customer_message");

  const tattooIntent = /quero (?:fazer|tatuar)|vou fazer|vamos fazer|(?:uma |a )?(?:tattoo|tatuagem)/iu.test(joined);
  if (!facts.tattooIntent.value) facts.tattooIntent = knownFact(tattooIntent, "high", "conversation_analysis");

  const referenceReceived = /refer[eê]ncia|imagem de (?:refer[eê]ncia de )?(?:tattoo|tatuagem)/iu.test(joined);
  const imageReceived = /imagem (?:de refer[eê]ncia )?|cliente enviou imagem/iu.test(joined);
  const audioReceived = /[aá]udio recebido|cliente enviou [aá]udio/iu.test(joined) ||
    (history || []).some((item) => item?.media_type === "audio" || item?.mediaType === "audio");
  if (!facts.referenceReceived.value) facts.referenceReceived = knownFact(referenceReceived, "high", referenceReceived ? "customer_message" : "conversation_analysis");
  if (!facts.imageReceived.value) facts.imageReceived = knownFact(imageReceived, "high", imageReceived ? "media_context" : "conversation_analysis");
  if (!facts.audioReceived.value) facts.audioReceived = knownFact(audioReceived, "high", audioReceived ? "media_context" : "conversation_analysis");

  const style = lastMatch(texts, /\b(fineline|fine line|blackwork|realismo|old school|pontilhismo|aquarela|minimalista|tribal|lettering)\b/iu, (match) => match[1].toLowerCase());
  if (style) facts.tattooStyle = knownFact(style, "high", "customer_explicit");

  const location = lastMatch(texts, /\b(bra[cç]o fechado|fechamento de bra[cç]o|meia manga|manga fechada|costas fechadas|antebra[cç]o|bra[cç]o|costas|peito|perna|panturrilha|coxa|ombro|costela|m[aã]o|pesco[cç]o)\b/iu, (match) => match[1].toLowerCase());
  if (location) facts.bodyLocation = knownFact(location, "high", "customer_explicit");

  const size = lastMatch(texts, /\b(\d+(?:[.,]\d+)?)\s*(cm|cent[ií]metros?)\b/iu, (match) => `${match[1].replace(",", ".")} cm`);
  if (size) facts.approximateSize = knownFact(size);

  const firstTattoo = lastMatch(texts, /\b(?:n[aã]o [eé] (?:a )?primeira(?: tatuagem| tattoo)?|j[aá] tenho (?:outra|tatuagem|tattoo)|(?:minha )?primeira (?:tatuagem|tattoo))\b/iu, (match) => !/n[aã]o [eé]|j[aá] tenho/iu.test(match[0]));
  if (firstTattoo !== null) facts.firstTattoo = knownFact(firstTattoo);

  const hours = lastMatch(texts, /\b(?:estimad[oa] em |cerca de |aproximadamente )?(\d+(?:[.,]\d+)?)\s*horas?\b/iu, (match) => Number(match[1].replace(",", ".")));
  if (hours !== null) facts.estimatedHours = knownFact(hours, "high", "explicit_conversation_value");
  const price = lastMatch(texts, /R\$\s*(\d+(?:[.,]\d{1,2})?)/iu, (match) => Number(match[1].replace(",", ".")));
  if (price !== null) facts.estimatedPrice = knownFact(price, "high", "explicit_conversation_value");

  const objections = texts.filter((item) => classifySignals({ text: item }).categories.includes(SIGNAL_CATEGORIES.OBJECTION));
  if (objections.length) facts.objections = knownFact([...new Set([...(facts.objections.value || []), ...objections])], "high", "customer_message");
  const buyingSignals = texts.filter((item) =>
    classifySignals({ text: item }).categories.includes(SIGNAL_CATEGORIES.BUYING_SIGNAL) ||
    /pre[cç]o|valor|or[cç]amento|orcamento|quanto (?:fica|custa|sai|tempo)|dura[cç][aã]o|quantas horas|demora/iu.test(item)
  );
  if (buyingSignals.length) facts.buyingSignals = knownFact([...new Set([...(facts.buyingSignals.value || []), ...buyingSignals])], "high", "customer_message");

  if (!facts.schedulingIntent.value) facts.schedulingIntent = knownFact(categories.has(SIGNAL_CATEGORIES.SCHEDULING_INTENT), "high", "signal_classifier");
  if (!facts.paymentIntent.value) facts.paymentIntent = knownFact(categories.has(SIGNAL_CATEGORIES.PAYMENT_INTENT), "high", "signal_classifier");
  if (!facts.humanRequest.value) facts.humanRequest = knownFact(categories.has(SIGNAL_CATEGORIES.HUMAN_REQUEST), "high", "signal_classifier");
  return facts;
}

export function findMissingFacts(facts) {
  const required = ["tattooIntent", "referenceReceived", "bodyLocation", "approximateSize", "firstTattoo"];
  return required.filter((key) =>
    !hasKnownFact(facts, key) || (["tattooIntent", "referenceReceived"].includes(key) && facts[key].value === false)
  );
}
