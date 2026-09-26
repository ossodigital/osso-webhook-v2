// Fonte única de verdade comercial do estúdio (preços, sinais, profissionais).
// Prompt do agente, motor de preço, respostas determinísticas e dashboard leem
// daqui. Para mudar um valor, mude SOMENTE este arquivo.

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

export const STUDIO_CATALOG = deepFreeze({
  currency: "BRL",
  tattoo: {
    professional: "Coringa",
    minimum: 150,
    sessions: { 3: 650, 6: 1200 },
    deposit: { amount: 100, deductedFromTotal: true }
  },
  piercing: {
    professional: "Jennyfer",
    instagram: "@jennyfertattoopierce",
    deposit: { amount: 40, perApplication: true, deductedFromTotal: true },
    // Disponibilidade de horário não é consultável automaticamente: sempre
    // exige confirmação humana (não existe integração de agenda do piercing).
    availabilityLookup: false,
    procedures: {
      segundo_furo: {
        label: "segundo furo",
        options: [
          { material: "aco", label: "aço", amount: 60, from: false },
          { material: "titanio", label: "titânio", amount: 80, from: true }
        ]
      },
      ponto_de_luz_micro: {
        label: "ponto de luz micro",
        options: [
          { material: "titanio", label: "titânio", amount: 90, from: false }
        ]
      }
    }
  }
});

export function formatBRL(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? `R$${value.toLocaleString("pt-BR")}` : `R$${value.toFixed(2).replace(".", ",")}`;
}

export function getPiercingProcedure(key) {
  return STUDIO_CATALOG.piercing.procedures[key] || null;
}

export function formatPiercingOption(option) {
  return `${option.label} ${option.from ? "a partir de " : ""}${formatBRL(option.amount)}`;
}

// Opções de preço para um procedimento (opcionalmente filtradas pelo material).
// Retorna null quando o procedimento não está na tabela (preço não tabelado).
export function piercingPriceOptions(procedureKey, material = null) {
  const procedure = getPiercingProcedure(procedureKey);
  if (!procedure) return null;
  const filtered = material ? procedure.options.filter((option) => option.material === material) : [];
  return filtered.length ? filtered : procedure.options;
}

export function piercingDepositText() {
  const { deposit } = STUDIO_CATALOG.piercing;
  return `O sinal é de ${formatBRL(deposit.amount)} por aplicação e é descontado do valor final.`;
}

// Linhas da tabela de piercing (usado no prompt e no resumo do dashboard).
export function piercingPriceTableLines() {
  return Object.values(STUDIO_CATALOG.piercing.procedures).map((procedure) =>
    `${procedure.label.charAt(0).toUpperCase()}${procedure.label.slice(1)}: ${procedure.options.map(formatPiercingOption).join("; ")}`
  );
}

export function tattooPriceLines() {
  const { tattoo } = STUDIO_CATALOG;
  return [
    `Valor mínimo da tatuagem: ${formatBRL(tattoo.minimum)}`,
    ...Object.entries(tattoo.sessions).map(([hours, amount]) => `Sessão de aproximadamente ${hours} horas: ${formatBRL(amount)}`)
  ];
}

// Valores que só fazem sentido para tattoo. Se aparecerem numa resposta sobre
// piercing, a resposta está misturando serviços.
export function tattooOnlyAmounts() {
  const { tattoo } = STUDIO_CATALOG;
  return [tattoo.minimum, ...Object.values(tattoo.sessions)];
}
