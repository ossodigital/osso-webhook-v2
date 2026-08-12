const ORDER = Object.freeze({ novo: 0, captando_nome: 0, curioso: 0, orcamento: 1, quente: 2, agendamento: 3 });

export function preserveCommercialStage({ previousStage = null, candidateStage = null, schedulingIntent = false } = {}) {
  if (previousStage === "humano") return "humano";
  let candidate = candidateStage === "humano" ? previousStage || "novo" : candidateStage || previousStage || "novo";
  if (schedulingIntent) candidate = "agendamento";
  if (ORDER[previousStage] > ORDER[candidate]) return previousStage;
  return candidate;
}
