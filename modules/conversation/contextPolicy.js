import { getMissingQualification, MEMORY_SOURCES } from "../memory/leadMemory.js";
import { SALES_OBJECTIVES } from "../sales/salesStrategy.js";

export const CONTEXT_FACTS = Object.freeze({
  NAME: "NAME",
  TATTOO_INTENT: "TATTOO_INTENT",
  REFERENCE: "REFERENCE",
  STYLE: "STYLE",
  BODY_LOCATION: "BODY_LOCATION",
  SIZE: "SIZE",
  FIRST_TATTOO: "FIRST_TATTOO"
});

export const CONTEXT_DECISIONS = Object.freeze({
  ASK_NEXT_FACT: "ASK_NEXT_FACT",
  CLARIFY_FACT: "CLARIFY_FACT",
  CLARIFY_PREVIOUS_RESPONSE: "CLARIFY_PREVIOUS_RESPONSE",
  CONTINUE_SALES: "CONTINUE_SALES",
  WAIT: "WAIT",
  NO_QUESTION: "NO_QUESTION",
  HUMAN_REVIEW: "HUMAN_REVIEW"
});

const FACT_PATHS = Object.freeze({
  [CONTEXT_FACTS.NAME]: "identity.name",
  [CONTEXT_FACTS.TATTOO_INTENT]: "tattoo.intent",
  [CONTEXT_FACTS.REFERENCE]: "tattoo.referenceReceived",
  [CONTEXT_FACTS.STYLE]: "tattoo.style",
  [CONTEXT_FACTS.BODY_LOCATION]: "tattoo.bodyLocation",
  [CONTEXT_FACTS.SIZE]: "tattoo.size",
  [CONTEXT_FACTS.FIRST_TATTOO]: "tattoo.firstTattoo"
});

const PATH_FACTS = Object.freeze(Object.fromEntries(
  Object.entries(FACT_PATHS).map(([fact, path]) => [path, fact])
));

const QUALIFICATION_PRIORITY = Object.freeze([
  CONTEXT_FACTS.NAME,
  CONTEXT_FACTS.TATTOO_INTENT,
  CONTEXT_FACTS.REFERENCE,
  CONTEXT_FACTS.BODY_LOCATION,
  CONTEXT_FACTS.SIZE,
  CONTEXT_FACTS.FIRST_TATTOO,
  CONTEXT_FACTS.STYLE
]);

const STABLE_SOURCES = new Set([
  MEMORY_SOURCES.CUSTOMER_EXPLICIT,
  MEMORY_SOURCES.CUSTOMER_CONFIRMED,
  MEMORY_SOURCES.EXISTING_FACT
]);

const OBSERVED_EVENT_FACTS = new Set([
  CONTEXT_FACTS.TATTOO_INTENT,
  CONTEXT_FACTS.REFERENCE
]);

function valueAtPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function hasKnownValue(memory, fact) {
  const value = valueAtPath(memory, FACT_PATHS[fact]);
  return value !== null && value !== undefined && value !== false && value !== "";
}

function provenanceFor(memory, fact) {
  return memory?.provenance?.[FACT_PATHS[fact]] || null;
}

export function shouldAskFact(memory, fact) {
  if (!FACT_PATHS[fact] || !hasKnownValue(memory, fact)) return true;
  const provenance = provenanceFor(memory, fact);
  if (OBSERVED_EVENT_FACTS.has(fact) && provenance?.confidence === "high") return false;
  if (!provenance || !STABLE_SOURCES.has(provenance.source)) return true;
  return provenance.confidence === "low";
}

export function getBlockedQuestions(memory) {
  return Object.values(CONTEXT_FACTS).filter((fact) => !shouldAskFact(memory, fact));
}

function knownFacts(memory) {
  return Object.values(CONTEXT_FACTS).filter((fact) => hasKnownValue(memory, fact));
}

function missingFacts(memory) {
  const structurallyMissing = new Set(getMissingQualification(memory).map((path) => PATH_FACTS[path]));
  return QUALIFICATION_PRIORITY.filter((fact) => structurallyMissing.has(fact) || shouldAskFact(memory, fact));
}

function result({ decision, known, missing, blocked, nextFact = null, shouldAsk = false, shouldWait = false, reason }) {
  return {
    knownFacts: known,
    missingFacts: missing,
    blockedQuestions: blocked,
    nextFact,
    shouldAsk,
    shouldWait,
    decision,
    reason
  };
}

function currentText(conversationState) {
  return String(conversationState?.signals?.text || "").trim();
}

function currentIntentDecision(conversationState, salesStrategy) {
  const objective = salesStrategy?.objective;
  if (objective === SALES_OBJECTIVES.HANDOFF_CANDIDATE || conversationState?.facts?.humanRequest?.value === true) {
    return { decision: CONTEXT_DECISIONS.HUMAN_REVIEW, reason: "pedido humano atual exige revisão, não nova qualificação" };
  }
  if (objective === SALES_OBJECTIVES.PAYMENT) {
    return { decision: CONTEXT_DECISIONS.CONTINUE_SALES, reason: "intenção atual de pagamento tem prioridade" };
  }
  if (objective === SALES_OBJECTIVES.SCHEDULE) {
    return { decision: CONTEXT_DECISIONS.CONTINUE_SALES, reason: "intenção atual de agendamento tem prioridade" };
  }
  if (objective === SALES_OBJECTIVES.HANDLE_OBJECTION) {
    return { decision: CONTEXT_DECISIONS.CONTINUE_SALES, reason: "objeção atual deve ser tratada antes de qualificar" };
  }
  const asksPrice = /pre[cç]o|valor|quanto|or[cç]amento|orcamento|custa/iu.test(currentText(conversationState));
  if (asksPrice || objective === SALES_OBJECTIVES.ESTIMATE_PROJECT && asksPrice) {
    return { decision: CONTEXT_DECISIONS.CONTINUE_SALES, reason: "pergunta atual de preço tem prioridade" };
  }
  return null;
}

export function evaluateContextPolicy({ memory, conversationState = {}, salesStrategy = {} } = {}) {
  const known = knownFacts(memory);
  const missing = missingFacts(memory);
  const blocked = getBlockedQuestions(memory);
  const base = { known, missing, blocked };
  const text = currentText(conversationState);

  if (/^\?{2,}$/u.test(text)) {
    return result({
      ...base,
      decision: CONTEXT_DECISIONS.CLARIFY_PREVIOUS_RESPONSE,
      reason: "cliente sinalizou que a resposta anterior não ficou clara"
    });
  }

  if (memory?.conversation?.waitingForCustomer === true || conversationState.waitingForCustomer === true || salesStrategy.shouldWait === true) {
    return result({
      ...base,
      decision: CONTEXT_DECISIONS.WAIT,
      shouldWait: true,
      reason: "cliente indicou que responderá depois"
    });
  }

  const intentDecision = currentIntentDecision(conversationState, salesStrategy);
  if (intentDecision) return result({ ...base, ...intentDecision });

  const nextFact = QUALIFICATION_PRIORITY.find((fact) => missing.includes(fact)) || null;
  if (nextFact) {
    const clarification = hasKnownValue(memory, nextFact);
    return result({
      ...base,
      decision: clarification ? CONTEXT_DECISIONS.CLARIFY_FACT : CONTEXT_DECISIONS.ASK_NEXT_FACT,
      nextFact,
      shouldAsk: true,
      reason: clarification
        ? `${nextFact} existe apenas como dado incerto e pode ser confirmado`
        : `${nextFact} é o próximo fato útil ainda desconhecido`
    });
  }

  const noQuestion = salesStrategy?.action === "NO_ACTION";
  return result({
    ...base,
    decision: noQuestion ? CONTEXT_DECISIONS.NO_QUESTION : CONTEXT_DECISIONS.CONTINUE_SALES,
    reason: noQuestion ? "estratégia atual não requer pergunta" : "contexto necessário já está disponível"
  });
}
