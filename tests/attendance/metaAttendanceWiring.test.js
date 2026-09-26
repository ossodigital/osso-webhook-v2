import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Caracterização da integração em api/meta.js (mesmo padrão de
// tests/stages/metaHandoffFlow.characterization.test.js).
const metaSource = await readFile(new URL("../../api/meta.js", import.meta.url), "utf8");
const dashboardProxy = await readFile(new URL("../../api/dashboard.js", import.meta.url), "utf8");
const dashboardHtml = await readFile(new URL("../../dashboard/index.html", import.meta.url), "utf8");

test("LLM recebe janela maior que 4 e o estado vem do log completo", () => {
  assert.match(metaSource, /carregarHistoricoConversa\(phone, LLM_HISTORY_WINDOW\)/u);
  assert.doesNotMatch(metaSource, /carregarHistoricoConversa\(phone, 4\)/u);
  assert.match(metaSource, /deriveAttendanceState\(stateMessages \|\| \[\]\)/u);
});

test("decisão determinística acontece antes da chamada ao LLM", () => {
  const decisionIndex = metaSource.indexOf("decideAttendanceTurn(attendanceState)");
  const llmIndex = metaSource.indexOf("gerarRespostaAtendimento({");
  assert.ok(decisionIndex > 0 && llmIndex > decisionIndex);
});

test("guarda da resposta roda antes de gravar/enviar a resposta do LLM", () => {
  const guardIndex = metaSource.indexOf("guardAttendanceReply({ reply");
  const sendIndex = metaSource.lastIndexOf("await enviarWhatsApp(phone, reply)");
  assert.ok(guardIndex > 0 && sendIndex > guardIndex);
});

test("handoff de atendimento não duplica o alerta legado", () => {
  assert.match(metaSource, /!pilotEnabled && !attendanceHandoffDone && effectiveStage === "humano"/u);
});

test("falha ao derivar estado não derruba o webhook", () => {
  assert.match(metaSource, /catch \(err\) \{\s*console\.error\("ATTENDANCE STATE ERROR:"/u);
});

test("lead humano existente continua bloqueando a IA antes de tudo", () => {
  const humanGuard = metaSource.indexOf('existingLead?.stage === "humano"');
  // A chamada do webhook termina em ";" (a do endpoint lead-state está num Promise.all).
  const stateLoad = metaSource.indexOf("buscarMensagensParaEstado(phone, ATTENDANCE_STATE_WINDOW);");
  assert.ok(humanGuard > 0 && stateLoad > humanGuard);
});

test("dashboard: lead-state liberado no proxy autenticado e painel de handoff presente", () => {
  assert.match(dashboardProxy, /"lead-state"/u);
  assert.match(metaSource, /req\.query\.debug === "lead-state"/u);
  assert.match(dashboardHtml, /id="handoffPanel"/u);
  assert.match(dashboardHtml, /debug=lead-state&phone=/u);
});

test("paginação/busca/filtro server-side do dashboard preservados", () => {
  assert.match(metaSource, /parseLeadsListParams\(req\.query\)/u);
  assert.match(metaSource, /listarLeadsRecentes\(\{ limit, offset, search, stage \}\)/u);
  assert.match(dashboardHtml, /atualizarPrimeiraPagina/u);
});
