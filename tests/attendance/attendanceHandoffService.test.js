import test from "node:test";
import assert from "node:assert/strict";
import { executarHandoffAtendimento } from "../../services/attendance/attendanceHandoffService.js";
import { deriveAttendanceState } from "../../modules/attendance/attendanceState.js";
import { CASE_002_MESSAGES } from "../fixtures/case-002-piercing-leandro.js";

const state = deriveAttendanceState(CASE_002_MESSAGES);

function fakeDeps({ updateError = null, alertOk = true, handoffStatus = "NOTIFIED" } = {}) {
  const calls = { update: [], alert: [], executeHandoff: [] };
  return {
    calls,
    deps: {
      updateLead: async (phone, payload) => { calls.update.push({ phone, payload }); return { error: updateError }; },
      alertAdmin: async (input) => { calls.alert.push(input); return [{ ok: alertOk }]; },
      executeHandoff: async (input) => { calls.executeHandoff.push(input); return { status: handoffStatus, notificationConfirmed: handoffStatus === "NOTIFIED" }; }
    }
  };
}

test("legado: grava stage humano e alerta o admin com o resumo operacional", async () => {
  const { calls, deps } = fakeDeps();
  const result = await executarHandoffAtendimento({ phone: "5511", leadName: "Leandro", state, reason: "AVAILABILITY_CONFIRMATION" }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.stage, "humano");
  assert.equal(calls.update[0].payload.stage, "humano");
  assert.equal(calls.alert.length, 1);
  assert.equal(calls.alert[0].reason, "AVAILABILITY_CONFIRMATION");
  assert.match(calls.alert[0].userText, /Falta confirmar disponibilidade/u);
  assert.match(calls.alert[0].userText, /aço R\$60 \| titânio a partir de R\$80/u);
});

test("legado: falha ao gravar o estado => ok=false (resposta não pode afirmar registro)", async () => {
  const { calls, deps } = fakeDeps({ updateError: { message: "db down" } });
  const result = await executarHandoffAtendimento({ phone: "5511", state, reason: "AVAILABILITY_CONFIRMATION" }, deps);
  assert.equal(result.ok, false);
  assert.equal(calls.alert.length, 0);
});

test("piloto: usa handoff_events e só confirma com status real", async () => {
  const ok = fakeDeps({ handoffStatus: "NOTIFIED" });
  const notified = await executarHandoffAtendimento({ phone: "5511", pilotEnabled: true, state, reason: "PENDING_CONFIRMATION_LOOP", commercialStage: "orcamento" }, ok.deps);
  assert.equal(notified.ok, true);
  assert.equal(ok.calls.update.length, 0);
  assert.equal(ok.calls.executeHandoff[0].decision.reason, "PENDING_CONFIRMATION_LOOP");
  assert.equal(ok.calls.executeHandoff[0].decision.required, true);

  const failed = fakeDeps({ handoffStatus: "NOTIFICATION_FAILED" });
  const result = await executarHandoffAtendimento({ phone: "5511", pilotEnabled: true, state, reason: "AVAILABILITY_CONFIRMATION" }, failed.deps);
  assert.equal(result.ok, false);
});
