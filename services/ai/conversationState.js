import { classifySignals, SIGNAL_CATEGORIES } from "../../modules/conversation/signalClassifier.js";
import { collectFacts, findMissingFacts } from "../../modules/qualification/collectedFacts.js";

export const CONVERSATION_OBJECTIVES = Object.freeze({
  DISCOVER_INTENT: "DISCOVER_INTENT",
  COLLECT_REFERENCE: "COLLECT_REFERENCE",
  QUALIFY_PROJECT: "QUALIFY_PROJECT",
  ESTIMATE_PROJECT: "ESTIMATE_PROJECT",
  HANDLE_OBJECTION: "HANDLE_OBJECTION",
  SCHEDULE: "SCHEDULE",
  PAYMENT: "PAYMENT",
  WAIT: "WAIT"
});

export function isWaitingForCustomer({ text = "", facts = null } = {}) {
  const normalizedText = String(text).toLowerCase().trim();
  if (/\b(vou pensar|te aviso|eu aviso|vou ver(?: e te falo)?|vou conversar e te falo)\b/iu.test(normalizedText)) return true;
  if (facts?.objections?.value?.some((item) => /\b(vou pensar|te aviso|eu aviso|vou ver(?: e te falo)?|vou conversar e te falo)\b/iu.test(item))) return true;
  return false;
}

export function selectObjective({ facts, missingFacts, waitingForCustomer }) {
  if (waitingForCustomer) return CONVERSATION_OBJECTIVES.WAIT;
  if (facts.paymentIntent.value) return CONVERSATION_OBJECTIVES.PAYMENT;
  if (facts.schedulingIntent.value) return CONVERSATION_OBJECTIVES.SCHEDULE;
  if (facts.objections.value?.length) return CONVERSATION_OBJECTIVES.HANDLE_OBJECTION;
  if (!facts.tattooIntent.value) return CONVERSATION_OBJECTIVES.DISCOVER_INTENT;
  if (!facts.referenceReceived.value) return CONVERSATION_OBJECTIVES.COLLECT_REFERENCE;
  if (missingFacts.length) return CONVERSATION_OBJECTIVES.QUALIFY_PROJECT;
  return CONVERSATION_OBJECTIVES.ESTIMATE_PROJECT;
}

export function buildConversationState({
  text = "",
  history = [],
  previousStage = null,
  currentStage = null,
  signals = null,
  facts = null,
  previousFacts = null,
  name = null
} = {}) {
  const classifiedSignals = signals || classifySignals({ text, previousStage });
  const collectedFacts = facts || collectFacts({
    text,
    history,
    signals: classifiedSignals,
    previousFacts,
    name
  });
  const missingFacts = findMissingFacts(collectedFacts);
  const waitingForCustomer = isWaitingForCustomer({ text, facts: collectedFacts });
  const objective = selectObjective({ facts: collectedFacts, missingFacts, waitingForCustomer });
  const handoffCandidate = {
    value: classifiedSignals.categories.includes(SIGNAL_CATEGORIES.HANDOFF_SIGNAL),
    reasons: classifiedSignals.categories.filter((category) =>
      category === SIGNAL_CATEGORIES.HANDOFF_SIGNAL || category === SIGNAL_CATEGORIES.HUMAN_REQUEST
    )
  };

  return {
    previousStage,
    currentStage,
    signals: classifiedSignals,
    facts: collectedFacts,
    missingFacts,
    objective,
    handoffCandidate,
    waitingForCustomer
  };
}
