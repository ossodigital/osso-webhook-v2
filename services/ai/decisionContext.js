import { buildConversationState } from "./conversationState.js";
import { mergeLeadMemory } from "../../modules/memory/leadMemory.js";
import { evaluateContextPolicy } from "../../modules/conversation/contextPolicy.js";
import { determineSalesStrategy } from "../../modules/sales/salesStrategy.js";
import { calculateLeadScore } from "../../modules/sales/leadScoring.js";
import { evaluatePricing } from "../../modules/pricing/pricingEngine.js";
import { classifyObjection } from "../../modules/sales/objectionEngine.js";
import { maskPilotLead } from "./pilotConfig.js";

function userHistory(conversationHistory = []) {
  return conversationHistory
    .filter((item) => item?.role === "user" && typeof item.content === "string")
    .map((item) => ({ role: "user", content: item.content }));
}

export function buildPilotDecisionContext({
  phone,
  leadName,
  userText,
  conversationHistory = [],
  previousStage = null,
  currentStage = null,
  imageMode = false
} = {}) {
  const state = buildConversationState({
    text: userText,
    history: userHistory(conversationHistory),
    name: leadName,
    previousStage,
    currentStage,
    hasImage: imageMode
  });
  const memory = mergeLeadMemory(null, state);
  const salesStrategy = determineSalesStrategy(state);
  const contextPolicy = evaluateContextPolicy({ memory, conversationState: state, salesStrategy });
  const pricing = evaluatePricing({ conversationState: state });
  const objection = classifyObjection({ text: userText, conversationState: state });
  const leadScore = calculateLeadScore(state);

  return {
    knownFacts: contextPolicy.knownFacts,
    blockedFacts: contextPolicy.blockedQuestions,
    nextFact: contextPolicy.nextFact,
    currentIntent: state.signals.categories,
    contextDecision: contextPolicy.decision,
    shouldAsk: contextPolicy.shouldAsk,
    salesObjective: salesStrategy.objective,
    pricingStatus: pricing.status,
    pricingEstimate: pricing.estimate,
    objection: objection.hasObjection ? {
      type: objection.type,
      strategy: objection.recommendedStrategy
    } : null,
    waiting: contextPolicy.shouldWait,
    humanRequest: state.facts.humanRequest.value === true,
    handoffCandidate: false,
    leadScore: { score: leadScore.score, level: leadScore.level },
    lead: maskPilotLead(phone)
  };
}

export function createSafePilotLogger(logger = console) {
  return {
    success(context) {
      logger.log("[PILOT]", {
        lead: context.lead,
        stage: context.stage,
        salesObjective: context.salesObjective,
        knownFacts: context.knownFacts,
        blockedFacts: context.blockedFacts,
        nextFact: context.nextFact,
        pricingStatus: context.pricingStatus,
        objection: context.objection?.type || null,
        waiting: context.waiting,
        handoffCandidate: false
      });
    },
    failure(error, phone) {
      logger.error("[PILOT] FALLBACK_LEGACY", {
        lead: maskPilotLead(phone),
        error: error?.name || "PilotError"
      });
    }
  };
}

export function tryBuildPilotDecisionContext(input, {
  builder = buildPilotDecisionContext,
  logger = createSafePilotLogger()
} = {}) {
  try {
    const context = builder(input);
    const result = { ...context, stage: input.currentStage };
    logger.success(result);
    return result;
  } catch (error) {
    logger.failure(error, input.phone);
    return null;
  }
}
