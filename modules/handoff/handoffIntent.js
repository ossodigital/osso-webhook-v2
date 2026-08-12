const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim();

export function classifyHumanIntent({ text = "" } = {}) {
  const value = normalize(text);
  const humanIdentityRequest = /\b(voce|vc)\s+(?:e|eh)\s+(?:o\s+)?coringa\b/u.test(value);
  const handoffComplaint = /\b(nao|nunca)\s+(?:cham(?:ou|am)|encaminh(?:ou|am)|avis(?:ou|aram))\b|\bso\s+fal(?:a|am)\s+que\s+(?:vai|vao)\s+encaminhar\b/u.test(value);
  const humanRequestEscalated = handoffComplaint || /\bcade\s+(?:o\s+)?coringa\b|\bja\s+chamou\s+(?:o\s+)?coringa\b|\bestou\s+esperando\b.*\bcoringa\b/u.test(value);
  const directRequest = /\b(quero|preciso)\s+(?:falar|marcar|agendar)\b.*\bcoringa\b|\b(chama|chame|chamar)\s+(?:o\s+)?coringa\b|\b(?:falar|marcar|agendar)\b.*\bcom\s+(?:o\s+)?coringa\b/u.test(value);
  return {
    humanRequest: directRequest || humanRequestEscalated,
    humanIdentityRequest,
    humanRequestEscalated,
    handoffComplaint
  };
}
