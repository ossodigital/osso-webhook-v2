const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

export function parsePilotEnabled(value) {
  return /^(?:1|true|yes|on)$/iu.test(String(value || "").trim());
}

export function parsePilotNumbers(value) {
  return [...new Set(String(value || "")
    .split(/[;,\s]+/u)
    .map(normalizePhone)
    .filter(Boolean))];
}

export function isPilotAuthorized(phone, {
  enabled = process.env.CORINGA_AI_PILOT_ENABLED,
  numbers = process.env.CORINGA_AI_PILOT_NUMBERS
} = {}) {
  if (!parsePilotEnabled(enabled)) return false;
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone !== "" && parsePilotNumbers(numbers).includes(normalizedPhone);
}

export function preservePilotStage({ pilotEnabled = false, candidateStage, previousStage = null } = {}) {
  if (!pilotEnabled || candidateStage !== "humano") return candidateStage;
  return previousStage && previousStage !== "humano" ? previousStage : "novo";
}

export function maskPilotLead(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) return `***${normalized}`;
  return `***${normalized.slice(-4)}`;
}
