import { HANDOFF_STATUS } from "./handoffState.js";

export const CONVERSATION_OWNER = Object.freeze({
  AI: "AI",
  HUMAN_PENDING: "HUMAN_PENDING",
  HUMAN: "HUMAN"
});

export function ownershipForHandoff(status = HANDOFF_STATUS.NONE) {
  if (status === HANDOFF_STATUS.NOTIFIED) return CONVERSATION_OWNER.HUMAN_PENDING;
  if (status === HANDOFF_STATUS.TAKEN_OVER) return CONVERSATION_OWNER.HUMAN;
  return CONVERSATION_OWNER.AI;
}

export function evaluateHandoffRuntime({ status = HANDOFF_STATUS.NONE, text = "" } = {}) {
  const owner = ownershipForHandoff(status);
  if (owner === CONVERSATION_OWNER.HUMAN_PENDING) {
    return { owner, action: "HUMAN_PENDING", shouldCallLlm: false, shouldReply: false };
  }
  if (owner === CONVERSATION_OWNER.HUMAN) {
    return { owner, action: "HUMAN_ACTIVE", shouldCallLlm: false, shouldReply: false };
  }
  return { owner, action: "CONTINUE", shouldCallLlm: true, shouldReply: true };
}
