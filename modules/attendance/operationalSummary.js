// Resumo operacional do lead: o humano entende o caso sem reler a conversa.

import { formatRequestedWhen, piercingPriceLines } from "./attendancePolicy.js";
import {
  AVAILABILITY_STATUS,
  PENDING_ACTION,
  PRICE_STATUS,
  SERVICE_TYPE,
  piercingTypeLabel
} from "./attendanceState.js";

const PRICE_LABEL = Object.freeze({
  [PRICE_STATUS.AVAILABLE]: "tabela disponível",
  [PRICE_STATUS.INFORMED]: "já informado ao cliente",
  [PRICE_STATUS.REFERENCE_ONLY]: "referência (depende do projeto)",
  [PRICE_STATUS.NEEDS_HUMAN_CONFIRMATION]: "aguardando confirmação humana",
  [PRICE_STATUS.NOT_APPLICABLE]: "—"
});

const AVAILABILITY_LABEL = Object.freeze({
  [AVAILABILITY_STATUS.NOT_REQUESTED]: "não solicitada",
  [AVAILABILITY_STATUS.REQUESTED]: "solicitada",
  [AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION]: "aguardando confirmação",
  [AVAILABILITY_STATUS.RESOLVED]: "respondida"
});

const ACTION_LABEL = Object.freeze({
  [PENDING_ACTION.CONFIRM_AVAILABILITY]: "confirmar horário",
  [PENDING_ACTION.CONFIRM_PRICE]: "confirmar valor",
  [PENDING_ACTION.RESOLVE_PROMISE]: "responder confirmação prometida ao cliente"
});

const SERVICE_LABEL = Object.freeze({
  [SERVICE_TYPE.PIERCING]: "piercing",
  [SERVICE_TYPE.TATTOO]: "tattoo",
  [SERVICE_TYPE.UNKNOWN]: "não identificado"
});

function describeReason(state) {
  const parts = [];
  const procedure = piercingTypeLabel(state.piercing_type);
  const when = formatRequestedWhen(state);
  if (state.service_type === SERVICE_TYPE.PIERCING) {
    const what = procedure
      ? `${procedure}${state.piercing_location ? ` (${state.piercing_location})` : ""}`
      : "piercing";
    parts.push(`Cliente quer ${what}${when ? ` ${when}` : ""}.`);
  } else if (state.service_type === SERVICE_TYPE.TATTOO) {
    parts.push(`Cliente quer tattoo${when ? ` ${when}` : ""}.`);
  }
  if (state.price_status === PRICE_STATUS.AVAILABLE || state.price_status === PRICE_STATUS.INFORMED) parts.push("Preço disponível.");
  if (state.price_status === PRICE_STATUS.NEEDS_HUMAN_CONFIRMATION) parts.push("Falta confirmar valor (fora da tabela).");
  if (state.availability_status === AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION) parts.push("Falta confirmar disponibilidade.");
  if (state.loop_detected) parts.push(`Cliente já cobrou retorno; ${state.unresolved_promises} promessa(s) sem resolução.`);
  else if (state.pending_action === PENDING_ACTION.RESOLVE_PROMISE) parts.push("Há confirmação prometida ao cliente ainda sem resposta.");
  return parts.join(" ");
}

export function buildOperationalSummary(state) {
  if (!state) return null;
  const needsHuman = Boolean(state.human_handoff || state.pending_action || state.loop_detected);
  const fields = [
    { key: "service_type", label: "SERVIÇO", value: SERVICE_LABEL[state.service_type] || state.service_type },
    { key: "piercing_type", label: "PROCEDIMENTO", value: piercingTypeLabel(state.piercing_type) },
    { key: "piercing_location", label: "LOCAL", value: state.piercing_location },
    { key: "jewelry_material", label: "MATERIAL", value: state.jewelry_material === "aco" ? "aço" : state.jewelry_material === "titanio" ? "titânio" : state.jewelry_material },
    { key: "requested_date", label: "DATA", value: state.requested_date ? formatRequestedWhen({ requested_date: state.requested_date }) : null },
    { key: "requested_period", label: "PERÍODO", value: state.requested_period },
    { key: "price_status", label: "PREÇO", value: PRICE_LABEL[state.price_status] },
    { key: "availability_status", label: "DISPONIBILIDADE", value: AVAILABILITY_LABEL[state.availability_status] },
    { key: "pending_action", label: "AÇÃO", value: ACTION_LABEL[state.pending_action] || null },
    { key: "human_handoff", label: "HANDOFF", value: state.human_handoff ? "humano" : "IA" }
  ].filter((field) => field.value);

  const commercialContext = state.service_type === SERVICE_TYPE.PIERCING ? piercingPriceLines(state) : [];
  const reason = describeReason(state);
  const text = [
    reason,
    ...fields.map((field) => `${field.label}: ${field.value}`),
    commercialContext.length ? `Tabela: ${commercialContext.join(" | ")}` : null
  ].filter(Boolean).join("\n");

  return {
    needsHuman,
    headline: needsHuman ? "ATENDIMENTO HUMANO NECESSÁRIO" : "Atendimento com IA",
    reason,
    fields,
    commercialContext,
    text
  };
}
