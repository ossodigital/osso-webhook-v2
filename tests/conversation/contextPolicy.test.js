import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationState } from "../../services/ai/conversationState.js";
import { determineSalesStrategy } from "../../modules/sales/salesStrategy.js";
import { buildImageContext, IMAGE_SOURCES } from "../../modules/image/imageContext.js";
import { createEmptyLeadMemory, mergeLeadMemory } from "../../modules/memory/leadMemory.js";
import {
  CONTEXT_DECISIONS,
  CONTEXT_FACTS,
  evaluateContextPolicy,
  getBlockedQuestions,
  shouldAskFact
} from "../../modules/conversation/contextPolicy.js";

function stateFor(text, options = {}) {
  return buildConversationState({ text, currentStage: options.currentStage || "novo", ...options });
}

function policyFor(memory, text, options = {}) {
  const state = stateFor(text, options);
  const updatedMemory = options.skipMerge ? memory : mergeLeadMemory(memory, state);
  return {
    memory: updatedMemory,
    state,
    policy: evaluateContextPolicy({
      memory: updatedMemory,
      conversationState: state,
      salesStrategy: determineSalesStrategy(state)
    })
  };
}

function qualifiedMemory() {
  let memory = mergeLeadMemory(null, stateFor("Meu nome é Ana"));
  memory = mergeLeadMemory(memory, stateFor("Quero fazer uma tattoo blackwork no braço com 12 cm"));
  memory = mergeLeadMemory(memory, stateFor("cliente enviou imagem de referência de tattoo"));
  return mergeLeadMemory(memory, stateFor("Não é a primeira tattoo"));
}

test("CTX-001: memória vazia aponta apenas um primeiro fato", () => {
  const { policy } = policyFor(createEmptyLeadMemory(), "Oi");
  assert.equal(policy.decision, CONTEXT_DECISIONS.ASK_NEXT_FACT);
  assert.equal(policy.nextFact, CONTEXT_FACTS.NAME);
  assert.equal(policy.shouldAsk, true);
});

test("CTX-002: nome conhecido bloqueia pergunta de nome", () => {
  const memory = mergeLeadMemory(null, stateFor("Meu nome é Ana"));
  assert.ok(getBlockedQuestions(memory).includes(CONTEXT_FACTS.NAME));
});

test("CTX-003: referência conhecida bloqueia nova pergunta de referência", () => {
  const memory = mergeLeadMemory(null, stateFor("cliente enviou imagem de referência de tattoo"));
  assert.ok(getBlockedQuestions(memory).includes(CONTEXT_FACTS.REFERENCE));
});

test("CTX-004: local explícito conhecido bloqueia nova pergunta de local", () => {
  const memory = mergeLeadMemory(null, stateFor("Quero no braço"));
  assert.ok(getBlockedQuestions(memory).includes(CONTEXT_FACTS.BODY_LOCATION));
});

test("CTX-005: múltiplos fatos conhecidos são expostos semanticamente", () => {
  const memory = qualifiedMemory();
  const { policy } = policyFor(memory, "Oi", { skipMerge: true });
  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.NAME));
  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.REFERENCE));
  assert.ok(policy.knownFacts.includes(CONTEXT_FACTS.BODY_LOCATION));
});

test("CTX-006: política escolhe no máximo um próximo fato", () => {
  let memory = mergeLeadMemory(null, stateFor("Meu nome é Ana"));
  memory = mergeLeadMemory(memory, stateFor("Quero fazer uma tattoo blackwork no braço"));
  memory = mergeLeadMemory(memory, stateFor("cliente enviou imagem de referência de tattoo"));
  const { policy } = policyFor(memory, "Oi", { skipMerge: true });
  assert.equal(policy.nextFact, CONTEXT_FACTS.SIZE);
  assert.equal(Array.isArray(policy.nextFact), false);
});

test("CTX-007: waiting impede qualquer pergunta", () => {
  const { policy } = policyFor(null, "Vou pensar");
  assert.equal(policy.decision, CONTEXT_DECISIONS.WAIT);
  assert.equal(policy.shouldAsk, false);
  assert.equal(policy.shouldWait, true);
});

test("CTX-008: retorno após waiting libera agenda sem reiniciar qualificação", () => {
  const waiting = policyFor(null, "Vou pensar").memory;
  const { policy } = policyFor(waiting, "Quero marcar");
  assert.equal(policy.decision, CONTEXT_DECISIONS.CONTINUE_SALES);
  assert.equal(policy.shouldWait, false);
  assert.equal(policy.shouldAsk, false);
  assert.match(policy.reason, /agendamento/);
});

test("CTX-009: pergunta de preço tem prioridade sobre fato secundário", () => {
  const { policy } = policyFor(null, "Quanto fica?", { currentStage: "orcamento" });
  assert.equal(policy.decision, CONTEXT_DECISIONS.CONTINUE_SALES);
  assert.equal(policy.nextFact, null);
  assert.match(policy.reason, /preço/);
});

test("CTX-010: agenda tem prioridade", () => {
  const { policy } = policyFor(null, "Quero agendar");
  assert.match(policy.reason, /agendamento/);
  assert.equal(policy.shouldAsk, false);
});

test("CTX-011: pagamento tem prioridade", () => {
  const { policy } = policyFor(null, "Como pago o sinal?");
  assert.match(policy.reason, /pagamento/);
  assert.equal(policy.shouldAsk, false);
});

test("CTX-012: objeção tem prioridade", () => {
  const { policy } = policyFor(null, "Está caro", { currentStage: "orcamento" });
  assert.match(policy.reason, /objeção/);
  assert.equal(policy.shouldAsk, false);
});

test("CTX-013: pedido humano exige revisão sem executar handoff", () => {
  const { policy } = policyFor(null, "Quero falar com uma pessoa");
  assert.equal(policy.decision, CONTEXT_DECISIONS.HUMAN_REVIEW);
  assert.equal("shouldHandoff" in policy, false);
});

test("CTX-014: fato incerto de imagem pode ser confirmado", () => {
  const imageContext = buildImageContext({ hasImage: true, analysis: {
    tattooStyle: { value: "realismo", confidence: "low", source: IMAGE_SOURCES.MODEL_INFERENCE }
  }});
  const memory = mergeLeadMemory(null, stateFor("cliente enviou imagem", { imageContext }));
  assert.equal(shouldAskFact(memory, CONTEXT_FACTS.STYLE), true);
  assert.ok(!getBlockedQuestions(memory).includes(CONTEXT_FACTS.STYLE));
});

test("CTX-015: fato explícito não deve ser repetido", () => {
  const memory = mergeLeadMemory(null, stateFor("Quero em blackwork"));
  assert.equal(shouldAskFact(memory, CONTEXT_FACTS.STYLE), false);
});

test("CTX-016: correção explícita usa o fato atual", () => {
  let memory = mergeLeadMemory(null, stateFor("Vai ser no braço"));
  memory = mergeLeadMemory(memory, stateFor("Na verdade vai ser na panturrilha"));
  const { policy } = policyFor(memory, "Oi", { skipMerge: true });
  assert.equal(memory.tattoo.bodyLocation, "panturrilha");
  assert.ok(policy.blockedQuestions.includes(CONTEXT_FACTS.BODY_LOCATION));
});

test("CTX-017: retorno após horas ou dias preserva contexto e não reinicia onboarding", () => {
  const memory = qualifiedMemory();
  const { policy } = policyFor(memory, "Oi");
  assert.ok(policy.blockedQuestions.includes(CONTEXT_FACTS.NAME));
  assert.ok(policy.blockedQuestions.includes(CONTEXT_FACTS.REFERENCE));
  assert.notEqual(policy.nextFact, CONTEXT_FACTS.NAME);
});

test("CTX-018: ?? pede esclarecimento da resposta anterior", () => {
  const { policy } = policyFor(qualifiedMemory(), "??");
  assert.equal(policy.decision, CONTEXT_DECISIONS.CLARIFY_PREVIOUS_RESPONSE);
  assert.equal(policy.nextFact, null);
  assert.equal(policy.shouldAsk, false);
});

test("CTX-019: follow-up futuro não solicita fatos já conhecidos", () => {
  const memory = qualifiedMemory();
  const blocked = getBlockedQuestions(memory);
  assert.ok(blocked.includes(CONTEXT_FACTS.REFERENCE));
  assert.ok(blocked.includes(CONTEXT_FACTS.BODY_LOCATION));
  assert.ok(blocked.includes(CONTEXT_FACTS.SIZE));
});
