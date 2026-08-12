function json(value) {
  return JSON.stringify(value ?? null);
}

export function buildPilotPromptContext(decisionContext) {
  if (!decisionContext) return "";
  return `

CONTEXTO ESTRUTURADO DO PILOTO (prioridade sobre coleta genérica):
- fatos conhecidos: ${json(decisionContext.knownFacts)}
- fatos que não devem ser perguntados novamente: ${json(decisionContext.blockedFacts)}
- próximo fato útil, se aplicável: ${json(decisionContext.nextFact)}
- intenção atual: ${json(decisionContext.currentIntent)}
- objetivo comercial atual: ${json(decisionContext.salesObjective)}
- decisão de contexto: ${json(decisionContext.contextDecision)}
- pode perguntar agora: ${json(decisionContext.shouldAsk)}
- pricing: ${json({ status: decisionContext.pricingStatus, estimate: decisionContext.pricingEstimate })}
- objeção: ${json(decisionContext.objection)}
- waiting: ${json(decisionContext.waiting)}
- pedido humano: ${json(decisionContext.humanRequest)}
- handoff operacional: ${json(decisionContext.handoffDecision)}
- status do handoff: ${json(decisionContext.handoff)}

Regras obrigatórias do piloto:
- use os fatos conhecidos e nunca repita fatos bloqueados
- responda primeiro à intenção atual do cliente
- faça no máximo uma pergunta relevante por vez e somente se shouldAsk permitir
- não transforme o atendimento em formulário
- não invente preço; use somente o resultado explícito de pricing acima
- se waiting=true, não pressione nem continue qualificação
- trate objeção antes de continuar qualificação
- buying signal e lead score não significam handoff
- se houver pedido de identidade humana, diga claramente que você é a assistente virtual
- nunca diga que avisou, chamou ou encaminhou ao Coringa sem notificationConfirmed=true
- handoff operacional não altera nem rebaixa o estágio comercial
- não crie handoff automático fora da decisão determinística
- não crie handoff fora da decisão determinística acima`;
}
