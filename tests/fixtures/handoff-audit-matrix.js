export const PREVIOUS_STAGES = ["novo", "curioso", "quente", "orcamento", "agendamento", "humano"];

export const HANDOFF_AUDIT_CASES = [
  ["Fechado", "humano"], ["Quero fechar", "humano"], ["Pode fechar", "humano"],
  ["Vamos fechar", "humano"], ["Quero fechar essa tattoo", "humano"],
  ["Quero fechar o braço", "quente"], ["Braço fechado", "novo"],
  ["Manga fechada", "novo"], ["Projeto fechado no braço", "novo"],
  ["Quanto é o sinal?", "humano"], ["Como pago o sinal?", "quente"],
  ["Quero pagar o sinal", "humano"], ["Posso fazer o Pix?", "quente"],
  ["Me passa o Pix", "quente"], ["Já posso mandar o sinal?", "quente"],
  ["Quero marcar", "humano"], ["Pode agendar", "humano"],
  ["Quero agendar", "humano"], ["Tem horário?", "agendamento"],
  ["Qual dia tem?", "agendamento"], ["Tem horário sábado?", "agendamento"],
  ["Pode marcar pra sexta?", "agendamento"], ["Quero reservar uma data", "humano"],
  ["Quanto fica?", "orcamento"], ["Quanto custa?", "orcamento"],
  ["Queria um orçamento", "orcamento"], ["Qual o valor?", "orcamento"],
  ["Está caro", "novo"], ["Consegue melhorar o valor?", "orcamento"],
  ["Tem desconto?", "novo"], ["Consigo parcelar?", "novo"],
  ["Me passa o contato", "humano"], ["Quero falar com o Coringa", "humano"],
  ["Posso falar com o tatuador?", "novo"], ["Quero falar com uma pessoa", "novo"],
  ["Quero falar com alguém", "novo"], ["É o Coringa?", "novo"],
  ["Você é o Coringa?", "novo"], ["Tenho interesse", "novo"],
  ["Gostei", "novo"], ["Curti", "novo"], ["Pode ser", "novo"],
  ["Quero fazer", "quente"], ["Quero essa", "novo"],
  ["Quero fazer uma tattoo", "quente"], ["Estou pensando em fazer", "novo"],
  ["Fechar o braço", "quente"], ["Quero fazer o braço todo", "quente"],
  ["Meia manga", "novo"], ["Costas fechadas", "novo"],
  ["Fechamento de braço", "novo"], ["Vou pensar", "novo"],
  ["Vou ver e te falo", "novo"], ["Preciso falar com minha esposa", "novo"],
  ["Outro tatuador faz mais barato", "novo"], ["Tenho medo da dor", "novo"],
  ["Não sei se vou aguentar", "novo"], ["quero fazer uma tatuagem", "quente"],
  ["cliente enviou imagem de referência de tattoo", "orcamento"],
  ["cliente enviou imagem de tattoo", "orcamento"]
];

export function expectedForPreviousStage(baseStage, previousStage) {
  return baseStage === "novo" ? previousStage : baseStage;
}
