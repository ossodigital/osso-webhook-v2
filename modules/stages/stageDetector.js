function temIntencaoDeFechamento(text) {
  const contextosDeProjeto = [
    "braço fechado",
    "braco fechado",
    "manga fechada",
    "fechamento de braço",
    "fechamento de braco",
    "fechar o braço",
    "fechar o braco"
  ];

  if (contextosDeProjeto.some((contexto) => text.includes(contexto))) {
    return false;
  }

  const textoSemPontuacaoFinal = text.replace(/[.!?]+$/g, "").trim();
  if (textoSemPontuacaoFinal === "fechado") return true;

  return [
    "quero fechar",
    "fechar agora",
    "vamos fechar",
    "pode fechar",
    "bora fechar",
    "ta bom vamos fechar",
    "tá bom vamos fechar"
  ].some((intencao) => text.includes(intencao));
}

export default function detectarStage(userText = "", existingStage = null) {
  const text = userText.toLowerCase().trim();

  // ─── CURIOSO / SPAM ──────────────────────────────────────────────────────
  if (/calote|golpe|zoeira|brincadeira|kkk|kkkk/i.test(text)) {
    return "curioso";
  }

  // ─── HUMANO — handoff imediato ───────────────────────────────────────────
  if (
    text.includes("quero reservar") ||
    text.includes("reservar horário") ||
    text.includes("reservar horario") ||
    text.includes("reservar tattoo") ||
    text.includes("quero marcar") ||
    text.includes("marcar tattoo") ||
    text.includes("marcar tatuagem") ||
    text.includes("quero agendar") ||
    text.includes("pode agendar") ||
    temIntencaoDeFechamento(text) ||
    text.includes("vou pagar") ||
    text.includes("manda pix") ||
    text.includes("manda o pix") ||
    text.includes("atendimento humano") ||
    text.includes("falar com humano") ||
    text.includes("falar com coringa") ||
    text.includes("chama o coringa") ||
    text.includes("quero falar com o coringa") ||
    text.includes("me passa o número") ||
    text.includes("me passa o numero") ||
    text.includes("me passa o contato") ||
    text.includes("pagar o sinal") ||
    text.includes("quanto é o sinal") ||
    text.includes("quanto e o sinal") ||
    text.includes("aceito")
  ) {
    return "humano";
  }

  // ─── QUENTE — intenção de compra ─────────────────────────────────────────
  if (/pix|cart[aã]o|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer/i.test(text)) {
    return "quente";
  }

  // ─── AGENDAMENTO ─────────────────────────────────────────────────────────
  if (/agendar|marcar|hor[aá]rio|horario|agenda|quando pode|qual dia|tem vaga/i.test(text)) {
    return "agendamento";
  }

  // ─── ORÇAMENTO ───────────────────────────────────────────────────────────
  if (/pre[çc]o|valor|quanto|or[çc]amento|orcamento|custa|tattoo|tatuagem/i.test(text)) {
    return "orcamento";
  }

  return existingStage || "novo";
}
