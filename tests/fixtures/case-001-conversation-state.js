export const CASE_001_CONVERSATION_STATE = Object.freeze({
  name: "Allef",
  previousStage: "orcamento",
  currentStage: "orcamento",
  history: Object.freeze([
    { role: "user", content: "Oi boa tarde" },
    { role: "assistant", content: "Claro! Antes de continuar, como posso te chamar?" },
    { role: "user", content: "Allef" },
    { role: "user", content: "Quero fazer uma Tattoo" },
    { role: "user", content: "cliente enviou imagem de referência de tattoo", mediaType: "image" }
  ]),
  text: "Braço fechado"
});
