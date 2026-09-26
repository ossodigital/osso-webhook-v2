// Decide, por turno, se o atendimento responde com dado conhecido, chama o
// LLM ou escala para humano — e garante que a resposta nunca prometa uma ação
// que não foi executada de verdade.

import {
  formatBRL,
  formatPiercingOption,
  piercingDepositText,
  piercingPriceOptions,
  piercingPriceTableLines,
  tattooOnlyAmounts
} from "../../config/business/catalog.js";
import {
  AVAILABILITY_STATUS,
  PRICE_STATUS,
  SERVICE_TYPE,
  isPricedPiercingType,
  isPromise,
  normalizeText,
  piercingTypeLabel,
  PROMISE_PATTERN
} from "./attendanceState.js";

export const ATTENDANCE_ACTION = Object.freeze({
  LLM: "LLM",
  REPLY: "DETERMINISTIC_REPLY",
  HANDOFF: "HUMAN_HANDOFF"
});

export const ATTENDANCE_HANDOFF_REASON = Object.freeze({
  AVAILABILITY: "AVAILABILITY_CONFIRMATION",
  PRICE: "PRICE_CONFIRMATION",
  LOOP: "PENDING_CONFIRMATION_LOOP",
  UNBACKED_PROMISE: "UNBACKED_PROMISE"
});

export function decideAttendanceTurn(state) {
  if (!state || state.human_handoff) return { action: ATTENDANCE_ACTION.LLM };
  const current = state.current || {};
  const piercing = state.service_type === SERVICE_TYPE.PIERCING;

  if (state.loop_detected) {
    return { action: ATTENDANCE_ACTION.HANDOFF, reason: ATTENDANCE_HANDOFF_REASON.LOOP };
  }
  if (piercing && state.availability_status === AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION) {
    return { action: ATTENDANCE_ACTION.HANDOFF, reason: ATTENDANCE_HANDOFF_REASON.AVAILABILITY };
  }
  if (piercing && state.price_status === PRICE_STATUS.NEEDS_HUMAN_CONFIRMATION) {
    return { action: ATTENDANCE_ACTION.HANDOFF, reason: ATTENDANCE_HANDOFF_REASON.PRICE };
  }
  if (piercing && (current.asksPrice || current.mentionsMaterial || (current.mentionsPiercingType && state.price_requested))) {
    return { action: ATTENDANCE_ACTION.REPLY, reply: buildPiercingPriceReply(state) };
  }
  return { action: ATTENDANCE_ACTION.LLM };
}

function procedurePhrase(state) {
  const label = piercingTypeLabel(state.piercing_type);
  if (!label) return null;
  const location = state.piercing_location ? ` (${state.piercing_location})` : "";
  return `${label}${location}`;
}

export function formatRequestedWhen(state) {
  const parts = [];
  if (state.requested_date) {
    const [, month, day] = String(state.requested_date.date || "").split("-");
    const suffix = day && month && !/\//u.test(state.requested_date.label) ? ` (${day}/${month})` : "";
    parts.push(`${state.requested_date.label}${suffix}`);
  }
  if (state.requested_period) {
    const period = state.requested_period;
    parts.push(period === "tarde" || period === "noite" ? `à ${period}` : period === "manhã" ? "de manhã" : `às ${period}`);
  }
  return parts.join(" ");
}

// Linhas curtas de preço conhecido para o contexto atual (piercing).
export function piercingPriceLines(state) {
  if (state.piercing_type && isPricedPiercingType(state.piercing_type)) {
    const options = piercingPriceOptions(state.piercing_type, state.jewelry_material);
    return options.map(formatPiercingOption);
  }
  if (!state.piercing_type) return piercingPriceTableLines();
  return [];
}

export function buildPiercingPriceReply(state) {
  const deposit = piercingDepositText();

  if (state.piercing_type && isPricedPiercingType(state.piercing_type)) {
    const options = piercingPriceOptions(state.piercing_type, state.jewelry_material);
    const procedure = procedurePhrase(state);
    const chosen = state.jewelry_material && options.length === 1 && options[0].material === state.jewelry_material;
    const priceText = chosen
      ? `Para o ${procedure} em ${options[0].label}, o valor é ${options[0].from ? "a partir de " : ""}${formatBRL(options[0].amount)}.`
      : `Para o ${procedure}:\n${options.map((option) => `• ${formatPiercingOption(option)}`).join("\n")}`;
    const question = !chosen && options.length > 1
      ? "Prefere aço ou titânio?"
      : state.requested_date || state.requested_period ? "" : "Qual dia e período ficam melhores pra você?";
    return [priceText, deposit, question].filter(Boolean).join("\n\n");
  }

  const table = piercingPriceTableLines().map((line) => `• ${line}`).join("\n");
  return `Nossa tabela de piercing:\n${table}\n\n${deposit}\n\nQual piercing você quer fazer?`;
}

export function buildHandoffReply({ state, reason, handoffOk }) {
  const lines = [];
  const piercing = state?.service_type === SERVICE_TYPE.PIERCING;

  if (piercing) {
    const priceLines = piercingPriceLines(state);
    if (priceLines.length) {
      const procedure = procedurePhrase(state);
      lines.push(procedure
        ? `Para o ${procedure}, temos ${priceLines.join(" e ")}. ${piercingDepositText()}`
        : `Nossa tabela: ${priceLines.join(" | ")}. ${piercingDepositText()}`);
    } else if (reason === ATTENDANCE_HANDOFF_REASON.PRICE || state.price_status === PRICE_STATUS.NEEDS_HUMAN_CONFIRMATION) {
      lines.push(`O valor do ${piercingTypeLabel(state.piercing_type)} não está na nossa tabela, então precisa ser confirmado pela equipe.`);
    }
  }

  if (state?.availability_status === AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION) {
    const when = formatRequestedWhen(state);
    lines.push(when ? `Para ${when} preciso confirmar o horário disponível.` : "Preciso confirmar o horário disponível.");
  } else if (!lines.length) {
    lines.push("Essa confirmação precisa ser feita pela equipe.");
  }

  lines.push(handoffOk
    ? "Seu pedido já ficou registrado com a equipe, e a confirmação chega por aqui mesmo."
    : "Ainda não consegui registrar esse pedido para a equipe automaticamente.");

  return lines.join("\n\n");
}

const TATTOO_PRICE_MARKERS = /\bsess[aã]o de\b|\bvalor m[ií]nimo\b|\btamanho, local\b/iu;

export function mentionsTattooPricing(reply) {
  const text = String(reply || "");
  if (TATTOO_PRICE_MARKERS.test(text)) return true;
  return tattooOnlyAmounts().some((amount) => {
    const formatted = formatBRL(amount).replace("R$", "");
    const plain = String(amount);
    return new RegExp(`R\\$ ?(${formatted.replace(".", "\\.")}|${plain})(?![\\d.,])`, "u").test(text);
  });
}

function splitSentences(text) {
  return String(text || "").split(/(?<=[.!?])\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
}

export function stripPromises(reply) {
  return splitSentences(reply).filter((sentence) => !PROMISE_PATTERN.test(normalizeText(sentence))).join(" ").trim();
}

/**
 * Valida a resposta do LLM contra o estado estruturado.
 * - actionBacked=true quando uma ação real (handoff notificado/registrado) ocorreu neste turno.
 */
export function guardAttendanceReply({ reply = "", state = null, actionBacked = false } = {}) {
  if (!state) return { reply, rewritten: null, needsHandoff: false };

  if (state.service_type === SERVICE_TYPE.PIERCING && mentionsTattooPricing(reply)) {
    return { reply: buildPiercingPriceReply(state), rewritten: "TATTOO_PRICE_IN_PIERCING_CONTEXT", needsHandoff: false };
  }

  if (!actionBacked && isPromise(reply)) {
    return {
      reply: stripPromises(reply),
      rewritten: "UNBACKED_PROMISE",
      needsHandoff: true,
      reason: ATTENDANCE_HANDOFF_REASON.UNBACKED_PROMISE
    };
  }

  return { reply, rewritten: null, needsHandoff: false };
}
