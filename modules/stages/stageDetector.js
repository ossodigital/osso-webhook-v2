import { classifySignals } from "../conversation/signalClassifier.js";
import { classifyHandoffSignals } from "../handoff/handoffClassifier.js";
import { decideHandoff } from "../handoff/handoffPolicy.js";
import { classifyStage } from "./stageClassifier.js";
import { toLegacyStage } from "./stageCompatibility.js";

export function classifyConversationCompatibility(userText = "", existingStage = null) {
  const input = { text: userText, previousStage: existingStage };
  const signals = classifySignals(input);
  const stage = classifyStage(input);
  const handoff = classifyHandoffSignals({ text: userText, signals });
  const handoffDecision = decideHandoff({
    stage,
    previousStage: existingStage,
    signals,
    handoff,
    compatibilityMode: true
  });
  const legacyStage = toLegacyStage({ stage, handoffDecision });

  return { stage, signals, handoff, handoffDecision, legacyStage };
}

export default function detectarStage(userText = "", existingStage = null) {
  return classifyConversationCompatibility(userText, existingStage).legacyStage;
}
