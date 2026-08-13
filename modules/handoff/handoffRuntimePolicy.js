import { HANDOFF_STATUS } from "./handoffState.js";

export const CONVERSATION_OWNER = Object.freeze({
  AI: "AI",
  AI_HOLD: "AI_HOLD",
  HUMAN: "HUMAN"
});

const normalize = (value) => String(value || "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim();

export function isHoldCancellation(text = "") {
  return /\b(nao precisa mais (?:chamar|avisar)|pode continuar (?:voce|vc)|continua (?:voce|vc))\b/u.test(normalize(text));
}

export function ownershipForHandoff(status = HANDOFF_STATUS.NONE) {
  if (status === HANDOFF_STATUS.NOTIFIED) return CONVERSATION_OWNER.AI_HOLD;
  if (status === HANDOFF_STATUS.TAKEN_OVER) return CONVERSATION_OWNER.HUMAN;
  return CONVERSATION_OWNER.AI;
}

export function evaluateHandoffRuntime({ status = HANDOFF_STATUS.NONE, text = "" } = {}) {
  if (status === HANDOFF_STATUS.NOTIFIED && isHoldCancellation(text)) {
    return { owner: CONVERSATION_OWNER.AI, action: "RESOLVE_AND_CONTINUE", shouldCallLlm: true, shouldReply: true };
  }
  const owner = ownershipForHandoff(status);
  if (owner === CONVERSATION_OWNER.AI_HOLD) {
    return { owner, action: "HOLD", shouldCallLlm: false, shouldReply: true };
  }
  if (owner === CONVERSATION_OWNER.HUMAN) {
    return { owner, action: "HUMAN_ACTIVE", shouldCallLlm: false, shouldReply: false };
  }
  return { owner, action: "CONTINUE", shouldCallLlm: true, shouldReply: true };
}

export function buildHoldReply(leadName = null) {
  return leadName
    ? `Seu atendimento já foi sinalizado ao Coringa, ${leadName}.`
    : "Seu atendimento já foi sinalizado ao Coringa.";
}
