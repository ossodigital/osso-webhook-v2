import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { HANDOFF_STATUS } from "../../modules/handoff/handoffState.js";
import { guardHandoffReply } from "../../modules/handoff/falsePromiseGuard.js";
import {
  CONVERSATION_OWNER,
  evaluateHandoffRuntime
} from "../../modules/handoff/handoffRuntimePolicy.js";
import {
  releaseHandoffToAi,
  takeoverHandoff
} from "../../services/handoff/handoffLifecycleService.js";

const latest = (status, commercialStage = "quente") => async () => ({
  data: { phone: "5511", handoff_id: "h1", status, reason: "HUMAN_REQUEST", commercial_stage: commercialStage },
  error: null
});

const recorder = () => {
  const events = [];
  return {
    events,
    record: async (event) => { events.push(event); return { data: event, error: null }; }
  };
};

test("CRM-022-01: NONE mantém IA normal", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.NONE, text: "Quanto custa?" });
  assert.equal(result.owner, CONVERSATION_OWNER.AI);
  assert.equal(result.shouldCallLlm, true);
});

test("CRM-022-02: NOTIFIED transfere ownership e silencia a IA", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "Estou esperando o Coringa" });
  assert.equal(result.owner, CONVERSATION_OWNER.HUMAN_PENDING);
  assert.equal(result.shouldCallLlm, false);
  assert.equal(result.shouldReply, false);
});

test("CRM-022-03: reclamação em NOTIFIED não responde nem duplica alerta", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "Cadê o Coringa?" });
  assert.equal(result.action, "HUMAN_PENDING");
  assert.equal(result.shouldReply, false);
});

test("CRM-022-04: pedido de Pix em NOTIFIED não reabre handoff", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "Me passa o Pix" });
  assert.equal(result.action, "HUMAN_PENDING");
  assert.equal(result.shouldReply, false);
});

test("CRM-022-05: informação adicional é preservável sem reabrir comercial", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "É no braço direito" });
  assert.equal(result.shouldCallLlm, false);
  assert.equal(result.shouldReply, false);
});

test("CRM-022-06: Takeover persiste NOTIFIED para TAKEN_OVER", async () => {
  const sink = recorder();
  const result = await takeoverHandoff("5511", { findLatest: latest(HANDOFF_STATUS.NOTIFIED), record: sink.record });
  assert.equal(result.ok, true);
  assert.equal(sink.events[0].status, HANDOFF_STATUS.TAKEN_OVER);
});

test("CRM-022-07: TAKEN_OVER bloqueia resposta automática", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.TAKEN_OVER, text: "Oi" });
  assert.equal(result.owner, CONVERSATION_OWNER.HUMAN);
  assert.equal(result.shouldCallLlm, false);
  assert.equal(result.shouldReply, false);
});

test("CRM-022-08: Voltar IA persiste TAKEN_OVER para RESOLVED", async () => {
  const sink = recorder();
  const result = await releaseHandoffToAi("5511", { findLatest: latest(HANDOFF_STATUS.TAKEN_OVER), record: sink.record });
  assert.equal(result.ok, true);
  assert.equal(sink.events[0].status, HANDOFF_STATUS.RESOLVED);
  assert.equal(evaluateHandoffRuntime({ status: HANDOFF_STATUS.RESOLVED }).shouldCallLlm, true);
});

test("CRM-022-09: Voltar IA preserva commercial stage no evento", async () => {
  const sink = recorder();
  await releaseHandoffToAi("5511", { findLatest: latest(HANDOFF_STATUS.TAKEN_OVER, "agendamento"), record: sink.record });
  assert.equal(sink.events[0].commercial_stage, "agendamento");
});

test("CRM-022-10: NOTIFIED só volta para IA por lifecycle explícito", () => {
  const result = evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "Pode continuar você" });
  assert.equal(result.owner, CONVERSATION_OWNER.HUMAN_PENDING);
  assert.equal(result.shouldReply, false);
});

test("CRM-022-11: mensagens concorrentes em NOTIFIED não solicitam novo alerta", async () => {
  const results = await Promise.all([
    Promise.resolve(evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "Estou esperando" })),
    Promise.resolve(evaluateHandoffRuntime({ status: HANDOFF_STATUS.NOTIFIED, text: "Cadê ele?" }))
  ]);
  assert.ok(results.every((result) => result.action === "HUMAN_PENDING" && result.shouldCallLlm === false && result.shouldReply === false));
});

test("CRM-022-12: falha de leitura usa caminho sanitizado e sem LLM", () => {
  const source = fs.readFileSync(new URL("../../api/meta.js", import.meta.url), "utf8");
  assert.match(source, /STATE_UNAVAILABLE/);
  assert.match(source, /shouldCallLlm: false/);
  assert.match(source, /shouldReply: false/);
  const safeLog = source.split("\n").find((line) => line.includes("HANDOFF STATE READ FAILED"));
  assert.ok(safeLog);
  assert.doesNotMatch(safeLog, /phone|token|secret/iu);
});

test("CRM-022-13: alerta confirmado responde uma única vez com confirmação aprovada", () => {
  const reply = guardHandoffReply({
    reply: "resposta gerada",
    handoff: { status: HANDOFF_STATUS.NOTIFIED, notificationConfirmed: true }
  });
  assert.equal(reply, "Pronto, já avisei o Coringa por aqui.");
});

test("CRM-022-14: caminho NOTIFIED persiste entrada e não contém resposta automática", () => {
  const source = fs.readFileSync(new URL("../../api/meta.js", import.meta.url), "utf8");
  const runtimeBlock = source.slice(source.indexOf("if (pilotEnabled && (pilotHandoff.data"), source.indexOf("let leadName ="));
  assert.match(runtimeBlock, /inserirMensagem\(userMessagePayload\)/);
  assert.match(runtimeBlock, /atualizarLeadPorTelefone/);
  assert.doesNotMatch(runtimeBlock, /enviarWhatsApp|role:\s*["']assistant["']/);
});

test("CRM-022: dashboard separa stage comercial e ownership", () => {
  const source = fs.readFileSync(new URL("../../dashboard/index.html", import.meta.url), "utf8");
  assert.match(source, /Stage comercial:/);
  assert.match(source, /Humano — aguardando Coringa/);
  assert.match(source, /HUMAN_PENDING/);
  assert.match(source, /Atendimento humano/);
  assert.match(source, /IA ativa/);
});
