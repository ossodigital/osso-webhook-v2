export function classifyStage({ text = "", previousStage = null } = {}) {
  const normalizedText = String(text).toLowerCase().trim();

  if (/calote|golpe|zoeira|brincadeira|kkk|kkkk/iu.test(normalizedText)) return "curioso";
  if (/pix|cart[aã]o|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer/iu.test(normalizedText)) return "quente";
  if (/agendar|marcar|hor[aá]rio|horario|agenda|quando pode|qual dia|tem vaga/iu.test(normalizedText)) return "agendamento";
  if (/pre[cç]o|valor|quanto|or[cç]amento|orcamento|custa|tattoo|tatuagem/iu.test(normalizedText)) return "orcamento";

  return previousStage || "novo";
}
