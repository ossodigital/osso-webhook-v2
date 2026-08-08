export const CASE_001_ALLEF = Object.freeze({
  id: "CASE-001",
  leadName: "Allef",
  description: "Sequência aproximada conhecida; não representa o histórico integral de produção.",
  steps: Object.freeze([
    { input: "Oi boa tarde", existingStage: null, expectedStage: "novo" },
    { input: "Allef", existingStage: "captando_nome", expectedStage: "captando_nome" },
    { input: "Allef", existingStage: "novo", expectedStage: "novo", reason: "reclassificação após captura do nome" },
    { input: "Quero fazer uma Tattoo", existingStage: "novo", expectedStage: "quente" },
    {
      input: "cliente enviou imagem de referência de tattoo",
      existingStage: "quente",
      expectedStage: "orcamento",
      reason: "texto sintético usado atualmente pelo pipeline de imagem"
    },
    {
      input: "Braço fechado",
      existingStage: "orcamento",
      expectedStage: "orcamento",
      reason: "contexto de área/projeto não representa intenção comercial"
    }
  ]),
  expectedHandoff: false,
  productionEvidenceStillMissing: Object.freeze([
    "histórico integral e timestamps da conversa em produção",
    "valor do stage persistido imediatamente antes de 'Braço fechado'",
    "texto exato recebido no webhook que antecedeu o handoff",
    "versão/commit efetivamente implantado no momento do atendimento"
  ])
});
