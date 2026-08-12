import test from "node:test";
import assert from "node:assert/strict";
import { isPilotAuthorized, preservePilotStage } from "../../services/ai/pilotConfig.js";
import {
  buildPilotDecisionContext,
  createSafePilotLogger,
  tryBuildPilotDecisionContext
} from "../../services/ai/decisionContext.js";
import { buildPilotPromptContext } from "../../services/ai/pilotPrompt.js";
import { CONTEXT_DECISIONS, CONTEXT_FACTS } from "../../modules/conversation/contextPolicy.js";
import { PRICING_STATUS } from "../../modules/pricing/pricingEngine.js";
import { OBJECTION_TYPES } from "../../modules/sales/objectionEngine.js";

const authorizedPhone = "5511999999999";
const enabledConfig = { enabled: "true", numbers: `5511888888888, ${authorizedPhone}` };

function pilotFor(userText, options = {}) {
  return buildPilotDecisionContext({
    phone: authorizedPhone,
    leadName: options.leadName || "Ana",
    userText,
    conversationHistory: options.conversationHistory || [],
    previousStage: options.previousStage || "novo",
    currentStage: options.currentStage || "novo",
    imageMode: false
  });
}

test("PILOT-001: flag OFF mantém pipeline legado", () => {
  assert.equal(isPilotAuthorized(authorizedPhone, { ...enabledConfig, enabled: "false" }), false);
});

test("PILOT-002: flag ON com número fora da allowlist mantém legado", () => {
  assert.equal(isPilotAuthorized("5511777777777", enabledConfig), false);
});

test("PILOT-003: flag ON com número autorizado seleciona piloto", () => {
  assert.equal(isPilotAuthorized(authorizedPhone, enabledConfig), true);
});

test("PILOT-004: erro no piloto retorna contexto nulo para prompt legado", () => {
  const context = tryBuildPilotDecisionContext({ phone: authorizedPhone }, {
    builder: () => { throw new Error("pilot failed"); },
    logger: { success() {}, failure() {} }
  });
  assert.equal(context, null);
  assert.equal(buildPilotPromptContext(context), "");
});

test("PILOT-005: fato conhecido é bloqueado no prompt piloto", () => {
  const context = pilotFor("Oi", {
    conversationHistory: [{ role: "user", content: "Quero uma tattoo no braço" }]
  });
  assert.ok(context.blockedFacts.includes(CONTEXT_FACTS.BODY_LOCATION));
  assert.match(buildPilotPromptContext(context), /nunca repita fatos bloqueados/);
});

test("PILOT-006: CASE-001 após braço fechado não repete nome, referência ou local", () => {
  const context = pilotFor("Braço fechado", {
    leadName: "Allef",
    previousStage: "orcamento",
    currentStage: "orcamento",
    conversationHistory: [
      { role: "user", content: "Oi boa tarde" },
      { role: "user", content: "Quero fazer uma Tattoo" },
      { role: "user", content: "cliente enviou imagem de referência de tattoo" }
    ]
  });
  assert.ok(context.blockedFacts.includes(CONTEXT_FACTS.NAME));
  assert.ok(context.blockedFacts.includes(CONTEXT_FACTS.REFERENCE));
  assert.ok(context.blockedFacts.includes(CONTEXT_FACTS.BODY_LOCATION));
  assert.equal(context.nextFact, CONTEXT_FACTS.SIZE);
  assert.equal(context.handoffCandidate, false);
});

test("PILOT-007: pergunta de preço tem prioridade", () => {
  const context = pilotFor("Quanto fica?", { currentStage: "orcamento" });
  assert.match(context.salesObjective, /ESTIMATE/);
  assert.equal(context.nextFact, null);
});

test("PILOT-008: objeção tem prioridade", () => {
  const context = pilotFor("Está caro", { currentStage: "orcamento" });
  assert.equal(context.objection.type, OBJECTION_TYPES.PRICE);
  assert.equal(context.nextFact, null);
});

test("PILOT-009: vou pensar produz WAIT", () => {
  const context = pilotFor("Vou pensar", { currentStage: "orcamento" });
  assert.equal(context.waiting, true);
  assert.equal(context.contextDecision, CONTEXT_DECISIONS.WAIT);
});

test("PILOT-010: agenda tem prioridade sem handoff novo", () => {
  const context = pilotFor("Quero marcar");
  assert.equal(context.salesObjective, "SCHEDULE");
  assert.equal(context.handoffCandidate, false);
  assert.notEqual(preservePilotStage({ pilotEnabled: true, candidateStage: "humano", previousStage: "quente" }), "humano");
});

test("PILOT-011: sinal expõe R$100 sem handoff novo", () => {
  const context = pilotFor("Quanto é o sinal?");
  assert.equal(context.pricingStatus, PRICING_STATUS.ESTIMATE_AVAILABLE);
  assert.equal(context.pricingEstimate.amount, 100);
  assert.equal(context.handoffCandidate, false);
  assert.equal(preservePilotStage({ pilotEnabled: true, candidateStage: "humano", previousStage: "novo" }), "novo");
});

test("PILOT-012: ?? solicita esclarecimento anterior", () => {
  const context = pilotFor("??");
  assert.equal(context.contextDecision, CONTEXT_DECISIONS.CLARIFY_PREVIOUS_RESPONSE);
  assert.equal(context.nextFact, null);
});

test("PILOT-013: exceção nova permite que executor legado continue respondendo", () => {
  let legacyCalls = 0;
  const decisionContext = tryBuildPilotDecisionContext({ phone: authorizedPhone }, {
    builder: () => { throw new TypeError("boom"); },
    logger: { success() {}, failure() {} }
  });
  const reply = decisionContext === null ? (() => { legacyCalls += 1; return "resposta legada"; })() : "piloto";
  assert.equal(reply, "resposta legada");
  assert.equal(legacyCalls, 1);
});

test("PILOT-014: logs seguros não contêm telefone completo nem segredos", () => {
  const entries = [];
  const logger = createSafePilotLogger({
    log: (...args) => entries.push(args),
    error: (...args) => entries.push(args)
  });
  const context = tryBuildPilotDecisionContext({
    phone: authorizedPhone,
    leadName: "Ana",
    userText: "Quero uma tattoo",
    currentStage: "novo"
  }, { logger });
  const serialized = JSON.stringify(entries);
  assert.ok(context);
  assert.ok(!serialized.includes(authorizedPhone));
  assert.ok(!serialized.includes("AZURE_API_KEY"));
  assert.ok(!serialized.includes("WHATSAPP_TOKEN"));
  assert.match(serialized, /\*\*\*9999/);
});
