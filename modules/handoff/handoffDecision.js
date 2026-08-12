import { classifyClosingIntent } from "../sales/closingIntent.js";
import { classifyHumanIntent } from "./handoffIntent.js";

export function decideOperationalHandoff({ text = "", hasCommercialContext = false } = {}) {
  const human = classifyHumanIntent({ text });
  const closing = classifyClosingIntent({ text, hasCommercialContext });
  const required = human.humanRequest || human.humanRequestEscalated || closing.readyToClose;
  const reason = human.handoffComplaint ? "HANDOFF_COMPLAINT"
    : human.humanRequestEscalated ? "HUMAN_REQUEST_ESCALATED"
      : human.humanRequest ? "HUMAN_REQUEST"
        : closing.readyToClose ? "READY_TO_CLOSE" : null;
  return { required, reason, ...human, ...closing };
}
