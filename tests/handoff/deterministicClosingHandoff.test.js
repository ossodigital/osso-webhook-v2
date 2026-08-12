import test from "node:test";
import assert from "node:assert/strict";
import { classifyClosingIntent } from "../../modules/sales/closingIntent.js";
import { classifyHumanIntent } from "../../modules/handoff/handoffIntent.js";
import { decideOperationalHandoff } from "../../modules/handoff/handoffDecision.js";
import { HANDOFF_STATUS, transitionHandoff } from "../../modules/handoff/handoffState.js";
import { guardHandoffReply } from "../../modules/handoff/falsePromiseGuard.js";
import { preserveCommercialStage } from "../../modules/stages/stageTransitionPolicy.js";
import { executeHandoff } from "../../services/notifications/handoffService.js";
import { notifyHuman } from "../../services/notifications/humanNotification.js";

test("CRM-021: pedido de pagamento com contexto comercial está pronto para fechar", () => {
  const intent = classifyClosingIntent({ text: "Posso pagar o sinal no pix?", hasCommercialContext: true });
  assert.equal(intent.paymentIntent, true);
  assert.equal(intent.readyToClose, true);
});

test("CRM-021: pergunta isolada sobre sinal não antecipa handoff", () => {
  assert.equal(classifyClosingIntent({ text: "Quanto é o sinal?" }).readyToClose, false);
});

test("CRM-021: pedido humano, identidade e reclamação são intenções distintas", () => {
  assert.equal(classifyHumanIntent({ text: "Quero falar com o Coringa" }).humanRequest, true);
  assert.equal(classifyHumanIntent({ text: "Você é o Coringa?" }).humanIdentityRequest, true);
  const complaint = classifyHumanIntent({ text: "Vocês só falam que vão encaminhar" });
  assert.equal(complaint.handoffComplaint, true);
  assert.equal(complaint.humanRequestEscalated, true);
});

test("CRM-021: decisão determinística produz motivo auditável", () => {
  assert.equal(decideOperationalHandoff({ text: "Chama o Coringa" }).reason, "HUMAN_REQUEST");
  assert.equal(decideOperationalHandoff({ text: "Cadê o Coringa?" }).reason, "HUMAN_REQUEST_ESCALATED");
});

test("CRM-021: máquina de estados aceita somente transições válidas", () => {
  assert.equal(transitionHandoff(HANDOFF_STATUS.NONE, HANDOFF_STATUS.REQUIRED), HANDOFF_STATUS.REQUIRED);
  assert.throws(() => transitionHandoff(HANDOFF_STATUS.NONE, HANDOFF_STATUS.NOTIFIED));
});

test("CRM-021: agendamento é monotônico e handoff não substitui estágio comercial", () => {
  assert.equal(preserveCommercialStage({ previousStage: "agendamento", candidateStage: "quente" }), "agendamento");
  assert.equal(preserveCommercialStage({ previousStage: "quente", candidateStage: "humano" }), "quente");
  assert.equal(preserveCommercialStage({ previousStage: "quente", candidateStage: "quente", schedulingIntent: true }), "agendamento");
});

test("CRM-021: resposta nunca promete alerta sem confirmação", () => {
  const reply = guardHandoffReply({ reply: "Já avisei o Coringa", handoff: { status: HANDOFF_STATUS.NOTIFICATION_FAILED }, leadName: "Ana" });
  assert.doesNotMatch(reply, /já avisei/iu);
  assert.match(reply, /não foi confirmado/iu);
});

test("CRM-021: adapter confirma apenas sucesso real do provider", async () => {
  const failed = await notifyHuman({ lead: { phone: "1" } }, { alert: async () => [{ ok: false }] });
  assert.equal(failed.success, false);
  const sent = await notifyHuman({ lead: { phone: "1" } }, { alert: async () => [{ ok: true, body: '{"messages":[{"id":"wamid.1"}]}' }] });
  assert.equal(sent.success, true);
  assert.equal(sent.notificationId, "wamid.1");
});

test("CRM-021: handoff notificado é deduplicado", async () => {
  let notifications = 0;
  const result = await executeHandoff({ lead: { phone: "1" }, decision: { required: true }, commercialStage: "agendamento" }, {
    findLatest: async () => ({ data: { status: HANDOFF_STATUS.NOTIFIED, created_at: new Date().toISOString(), handoff_id: "h1" }, error: null }),
    record: async () => { throw new Error("não deve registrar"); },
    notify: async () => { notifications += 1; }
  });
  assert.equal(result.deduplicated, true);
  assert.equal(result.notificationConfirmed, true);
  assert.equal(notifications, 0);
});

test("CRM-021: handoff pendente concorrente não duplica notificação", async () => {
  let notifications = 0;
  const result = await executeHandoff({ lead: { phone: "1" }, decision: { required: true } }, {
    findLatest: async () => ({ data: { status: HANDOFF_STATUS.NOTIFICATION_PENDING, handoff_id: "h1" }, error: null }),
    record: async () => { throw new Error("não deve registrar"); },
    notify: async () => { notifications += 1; }
  });
  assert.equal(result.status, HANDOFF_STATUS.NOTIFICATION_PENDING);
  assert.equal(result.deduplicated, true);
  assert.equal(notifications, 0);
});

test("CRM-021: falha de persistência impede envio e promessa", async () => {
  let notifications = 0;
  const result = await executeHandoff({ lead: { phone: "1" }, decision: { required: true, reason: "HUMAN_REQUEST" } }, {
    findLatest: async () => ({ data: null, error: null }),
    record: async () => ({ error: new Error("db") }),
    notify: async () => { notifications += 1; return { success: true }; }
  });
  assert.equal(result.notificationConfirmed, false);
  assert.equal(result.error, "HANDOFF_STATE_WRITE_FAILED");
  assert.equal(notifications, 0);
});

const goldenCases = [
  ["Quero falar com o Coringa", { required: true, humanRequest: true }],
  ["Você é o Coringa?", { required: false, humanIdentityRequest: true }],
  ["Cadê o Coringa?", { required: true, humanRequestEscalated: true }],
  ["Já chamou o Coringa? Estou esperando.", { required: true, humanRequestEscalated: true }],
  ["Quero marcar", { required: false, schedulingIntent: true }],
  ["Me passa o Pix do sinal", { required: true, paymentIntent: true, readyToClose: true }, true],
  ["Me passa o Pix do sinal que eu já quero marcar.", { required: true, paymentIntent: true, schedulingIntent: true, readyToClose: true }],
  ["Quero fechar hoje", { required: true, readyToClose: true }],
  ["Quero fazer a tatuagem e marcar o trabalho com o Coringa.", { required: true, humanRequest: true, schedulingIntent: true, readyToClose: true }],
  ["Vocês só falam que vão encaminhar e não chamam o Coringa.", { required: true, handoffComplaint: true, humanRequestEscalated: true }]
];

for (const [message, expected, hasCommercialContext = false] of goldenCases) {
  test(`CRM-021 golden: ${message}`, () => {
    const actual = decideOperationalHandoff({ text: message, hasCommercialContext });
    for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
  });
}

for (const message of [
  "Quanto custa?", "Gostei", "Estou pensando", "Tem como fazer no braço?", "Está caro",
  "Tem desconto?", "Qual valor?", "Vocês fazem realismo?", "Tenho uma referência", "Quero fazer uma tattoo"
]) {
  test(`CRM-021 negative: ${message}`, () => {
    assert.equal(decideOperationalHandoff({ text: message }).required, false);
  });
}
