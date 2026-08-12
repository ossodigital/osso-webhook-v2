import { SIGNAL_CATEGORIES } from "../conversation/signalClassifier.js";

export const SALES_OBJECTIVES = Object.freeze({
  DISCOVER_INTENT: "DISCOVER_INTENT",
  COLLECT_REFERENCE: "COLLECT_REFERENCE",
  QUALIFY_PROJECT: "QUALIFY_PROJECT",
  ESTIMATE_PROJECT: "ESTIMATE_PROJECT",
  HANDLE_OBJECTION: "HANDLE_OBJECTION",
  CHECK_BUYING_INTENT: "CHECK_BUYING_INTENT",
  SCHEDULE: "SCHEDULE",
  PAYMENT: "PAYMENT",
  WAIT_FOR_CUSTOMER: "WAIT_FOR_CUSTOMER",
  HANDOFF_CANDIDATE: "HANDOFF_CANDIDATE"
});

export const SALES_ACTIONS = Object.freeze({
  DISCOVER_INTENT: "DISCOVER_INTENT",
  COLLECT_REFERENCE: "COLLECT_REFERENCE",
  ASK_MISSING_FACT: "ASK_MISSING_FACT",
  PREPARE_ESTIMATE: "PREPARE_ESTIMATE",
  HANDLE_OBJECTION: "HANDLE_OBJECTION",
  CHECK_BUYING_INTENT: "CHECK_BUYING_INTENT",
  ADVANCE_SCHEDULING: "ADVANCE_SCHEDULING",
  SUPPORT_PAYMENT: "SUPPORT_PAYMENT",
  NO_ACTION: "NO_ACTION",
  FLAG_HANDOFF_CANDIDATE: "FLAG_HANDOFF_CANDIDATE"
});

const factValue = (state, key) => state?.facts?.[key]?.value;
const hasCategory = (state, category) => state?.signals?.categories?.includes(category) === true;

function result(objective, action, priority, reason, nextFact = null, shouldWait = false) {
  return {
    objective,
    action,
    priority,
    reason,
    nextFact,
    shouldWait,
    shouldHandoff: false
  };
}

function nextRelevantFact(state) {
  const priority = ["bodyLocation", "approximateSize", "firstTattoo"];
  return priority.find((key) => state?.missingFacts?.includes(key)) || null;
}

export function determineSalesStrategy(conversationState = {}) {
  if (conversationState.waitingForCustomer) {
    return result(
      SALES_OBJECTIVES.WAIT_FOR_CUSTOMER,
      SALES_ACTIONS.NO_ACTION,
      100,
      "cliente indicou que responderá depois",
      null,
      true
    );
  }

  if (factValue(conversationState, "humanRequest") || conversationState.handoffCandidate?.value) {
    return result(
      SALES_OBJECTIVES.HANDOFF_CANDIDATE,
      SALES_ACTIONS.FLAG_HANDOFF_CANDIDATE,
      95,
      "pedido humano explícito identificado"
    );
  }

  if (factValue(conversationState, "paymentIntent") || hasCategory(conversationState, SIGNAL_CATEGORIES.PAYMENT_INTENT)) {
    return result(SALES_OBJECTIVES.PAYMENT, SALES_ACTIONS.SUPPORT_PAYMENT, 90, "intenção de pagamento identificada");
  }

  if (factValue(conversationState, "schedulingIntent") || hasCategory(conversationState, SIGNAL_CATEGORIES.SCHEDULING_INTENT)) {
    return result(SALES_OBJECTIVES.SCHEDULE, SALES_ACTIONS.ADVANCE_SCHEDULING, 85, "intenção de agendamento identificada");
  }

  if (factValue(conversationState, "objections")?.length || hasCategory(conversationState, SIGNAL_CATEGORIES.OBJECTION)) {
    return result(SALES_OBJECTIVES.HANDLE_OBJECTION, SALES_ACTIONS.HANDLE_OBJECTION, 80, "objeção do cliente identificada");
  }

  const positiveAcknowledgement = /^(gostei|curti|quero essa|pode ser|aceito)[.!?]*$/iu.test(conversationState?.signals?.text || "");
  if (positiveAcknowledgement) {
    return result(SALES_OBJECTIVES.CHECK_BUYING_INTENT, SALES_ACTIONS.CHECK_BUYING_INTENT, 75, "sinal de compra identificado");
  }

  const explicitEstimateRequest = /pre[cç]o|valor|quanto|or[cç]amento|orcamento|custa/iu.test(conversationState?.signals?.text || "");
  if (conversationState.currentStage === "orcamento" && explicitEstimateRequest) {
    return result(SALES_OBJECTIVES.ESTIMATE_PROJECT, SALES_ACTIONS.PREPARE_ESTIMATE, 70, "conversa está em orçamento");
  }

  if (!factValue(conversationState, "tattooIntent")) {
    return result(SALES_OBJECTIVES.DISCOVER_INTENT, SALES_ACTIONS.DISCOVER_INTENT, 60, "intenção de tattoo ainda desconhecida");
  }

  if (!factValue(conversationState, "referenceReceived")) {
    return result(SALES_OBJECTIVES.COLLECT_REFERENCE, SALES_ACTIONS.COLLECT_REFERENCE, 55, "referência ainda não recebida");
  }

  const nextFact = nextRelevantFact(conversationState);
  if (nextFact) {
    return result(SALES_OBJECTIVES.QUALIFY_PROJECT, SALES_ACTIONS.ASK_MISSING_FACT, 50, `${nextFact} ainda desconhecido`, nextFact);
  }

  if (factValue(conversationState, "buyingSignals")?.length || hasCategory(conversationState, SIGNAL_CATEGORIES.BUYING_SIGNAL)) {
    return result(SALES_OBJECTIVES.CHECK_BUYING_INTENT, SALES_ACTIONS.CHECK_BUYING_INTENT, 47, "sinal de compra identificado com projeto qualificado");
  }

  return result(SALES_OBJECTIVES.ESTIMATE_PROJECT, SALES_ACTIONS.PREPARE_ESTIMATE, 45, "contexto essencial disponível");
}
