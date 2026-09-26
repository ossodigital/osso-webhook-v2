import test from "node:test";
import assert from "node:assert/strict";
import {
  AVAILABILITY_STATUS,
  PENDING_ACTION,
  PRICE_STATUS,
  SERVICE_TYPE,
  deriveAttendanceState,
  isPromise
} from "../../modules/attendance/attendanceState.js";
import {
  ATTENDANCE_ACTION,
  ATTENDANCE_HANDOFF_REASON,
  buildHandoffReply,
  decideAttendanceTurn,
  guardAttendanceReply
} from "../../modules/attendance/attendancePolicy.js";
import { buildOperationalSummary } from "../../modules/attendance/operationalSummary.js";
import { CASE_002_FORBIDDEN_REPLIES, CASE_002_MESSAGES } from "../fixtures/case-002-piercing-leandro.js";

const TATTOO_PRICE = /R\$ ?(150|650|1\.?200)(?![\d])/u;

// Espelha a ordem de decisão de api/meta.js para um lead sem handoff ativo:
// estado → decisão determinística → (LLM + guarda) → handoff real.
function simulate(userTexts, { llm = () => "Show! Me conta mais.", handoffOk = true } = {}) {
  const messages = [];
  const turns = [];
  let humanActive = false;
  let clock = Date.parse("2026-09-25T15:00:00Z");
  const at = () => new Date(clock += 60_000).toISOString();

  for (const text of userTexts) {
    messages.push({ role: "user", content: text, created_at: at() });
    if (humanActive) {
      turns.push({ text, action: "HUMAN_ACTIVE", reply: null });
      continue;
    }
    const state = deriveAttendanceState(messages);
    const decision = decideAttendanceTurn(state);
    let action = decision.action;
    let reason = decision.reason || null;
    let reply;
    if (decision.action === ATTENDANCE_ACTION.HANDOFF) {
      reply = buildHandoffReply({ state, reason, handoffOk });
      humanActive = handoffOk;
    } else if (decision.action === ATTENDANCE_ACTION.REPLY) {
      reply = decision.reply;
    } else {
      const guarded = guardAttendanceReply({ reply: llm(text, state), state });
      reply = guarded.reply;
      if (guarded.needsHandoff) {
        action = "GUARD_HANDOFF";
        reason = guarded.reason;
        reply = [guarded.reply, buildHandoffReply({ state, reason, handoffOk })].filter(Boolean).join("\n\n");
        humanActive = handoffOk;
      }
    }
    messages.push({ role: "assistant", content: reply, created_at: at() });
    turns.push({ text, action, reason, reply, state });
  }
  return turns;
}

const last = (turns) => turns[turns.length - 1];

test("1. 'quero piercing' + 'quanto custa?' nunca responde preço de tattoo", () => {
  const turns = simulate(["quero piercing", "quanto custa?"], { llm: () => "O valor mínimo é R$150." });
  const reply = last(turns).reply;
  assert.equal(last(turns).state.service_type, SERVICE_TYPE.PIERCING);
  assert.doesNotMatch(reply, TATTOO_PRICE);
  assert.match(reply, /R\$60/u);
  assert.match(reply, /R\$80/u);
});

test("2. 'segundo furo' + 'qual valor?' retorna a tabela do segundo furo", () => {
  const turns = simulate(["oi", "segundo furo", "qual valor?"]);
  const { reply, state, action } = last(turns);
  assert.equal(action, ATTENDANCE_ACTION.REPLY);
  assert.equal(state.piercing_type, "segundo_furo");
  assert.match(reply, /aço R\$60/u);
  assert.match(reply, /titânio a partir de R\$80/u);
  assert.match(reply, /R\$40 por aplicação/u);
});

test("3. 'titânio' no contexto de segundo furo => a partir de R$80", () => {
  const turns = simulate(["quero fazer o segundo furo", "titânio"]);
  const { reply, state } = last(turns);
  assert.equal(state.jewelry_material, "titanio");
  assert.match(reply, /a partir de R\$80/u);
  assert.doesNotMatch(reply, /R\$60/u);
});

test("3b. ponto de luz micro => R$90", () => {
  const turns = simulate(["quanto é o ponto de luz?"]);
  assert.match(last(turns).reply, /R\$90/u);
});

test("4. preço conhecido não chama humano", () => {
  const turns = simulate(["vcs fazem piercing?", "quanto fica o segundo furo na orelha?"]);
  const { action, state } = last(turns);
  assert.equal(action, ATTENDANCE_ACTION.REPLY);
  assert.equal(state.pending_action, null);
  assert.ok(turns.every((turn) => turn.action !== ATTENDANCE_ACTION.HANDOFF));
});

test("5. disponibilidade não consultável => handoff real com motivo explícito", () => {
  const turns = simulate(["quero piercing", "segundo furo na orelha esquerda", "vocês atendem amanhã à tarde?"]);
  const { action, reason, reply, state } = last(turns);
  assert.equal(action, ATTENDANCE_ACTION.HANDOFF);
  assert.equal(reason, ATTENDANCE_HANDOFF_REASON.AVAILABILITY);
  assert.equal(state.availability_status, AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION);
  assert.equal(state.pending_action, PENDING_ACTION.CONFIRM_AVAILABILITY);
  assert.match(reply, /aço R\$60 e titânio a partir de R\$80/u);
  assert.match(reply, /Para amanhã \(26\/09\) à tarde preciso confirmar o horário disponível\./u);
  assert.equal(isPromise(reply), false);
});

test("6. cliente pergunta de novo pela confirmação => nenhuma promessa repetida", () => {
  // handoff falhou: a IA continua respondendo, mas nunca promete.
  const turns = simulate(
    ["quero piercing", "segundo furo", "tem horário amanhã?", "conseguiu confirmar?", "tem previsão?"],
    { handoffOk: false, llm: () => "Vou confirmar com a Jennyfer e já te retorno!" }
  );
  for (const turn of turns) assert.equal(isPromise(turn.reply), false, turn.reply);
  assert.equal(last(turns).action, ATTENDANCE_ACTION.HANDOFF);
  assert.match(last(turns).reply, /Ainda não consegui registrar/u);
});

test("6b. promessa do LLM sem ação real vira handoff real, não promessa", () => {
  const turns = simulate(["vcs fazem piercing?"], { llm: () => "Fazemos sim! Vou confirmar com a Jennyfer e te dou um retorno." });
  const { action, reply } = last(turns);
  assert.equal(action, "GUARD_HANDOFF");
  assert.equal(isPromise(reply), false);
  assert.match(reply, /Fazemos sim!/u);
  assert.match(reply, /registrado com a equipe/u);
});

test("6c. promessa anterior + cobrança do cliente = loop detectado", () => {
  const state = deriveAttendanceState([
    { role: "user", content: "fazem piercing?" },
    { role: "assistant", content: "Fazemos! Vou verificar com a equipe e te aviso." },
    { role: "user", content: "e aí, tem previsão?" }
  ]);
  assert.equal(state.loop_detected, true);
  assert.equal(decideAttendanceTurn(state).reason, ATTENDANCE_HANDOFF_REASON.LOOP);
});

test("7. contexto piercing sobrevive a várias mensagens", () => {
  const fillers = ["ok", "legal", "entendi", "show", "beleza", "massa", "top", "certo", "valeu", "hmm", "blz", "tá"];
  const turns = simulate(["vcs fazem piercing?", ...fillers, "qual é a média de preço?"], {
    llm: () => "A média depende do tamanho. O valor mínimo é R$150 e a sessão de 3 horas custa R$650."
  });
  const { state, reply } = last(turns);
  assert.equal(state.service_type, SERVICE_TYPE.PIERCING);
  assert.doesNotMatch(reply, TATTOO_PRICE);
  for (const turn of turns) assert.doesNotMatch(turn.reply, TATTOO_PRICE);
});

test("8. mudança explícita para tattoo troca o service_type", () => {
  const turns = simulate(["quero piercing", "segundo furo", "agora queria ver uma tattoo", "quanto custa?"]);
  const { state, action } = last(turns);
  assert.equal(state.service_type, SERVICE_TYPE.TATTOO);
  assert.equal(state.piercing_type, null);
  assert.equal(action, ATTENDANCE_ACTION.LLM);
  assert.equal(state.price_status, PRICE_STATUS.REFERENCE_ONLY);
});

test("8b. 'orelha' numa conversa de tattoo não vira piercing", () => {
  const state = deriveAttendanceState([{ role: "user", content: "quero uma tattoo atrás da orelha" }]);
  assert.equal(state.service_type, SERVICE_TYPE.TATTOO);
});

test("8c. negação explícita: 'não é tattoo, é piercing'", () => {
  const state = deriveAttendanceState([
    { role: "user", content: "quero uma tattoo" },
    { role: "user", content: "não é tattoo, é piercing" }
  ]);
  assert.equal(state.service_type, SERVICE_TYPE.PIERCING);
});

test("pergunta genérica ('como funciona?') não é pedido de horário", () => {
  const turns = simulate(["quero piercing", "como funciona?", "e o sinal, como funciona?"]);
  assert.ok(turns.every((turn) => turn.action !== ATTENDANCE_ACTION.HANDOFF));
  assert.equal(last(turns).state.availability_status, AVAILABILITY_STATUS.NOT_REQUESTED);
});

test("procedimento fora da tabela => handoff por preço, sem inventar valor", () => {
  const turns = simulate(["quero piercing", "quanto custa o helix?"]);
  const { action, reason, reply } = last(turns);
  assert.equal(action, ATTENDANCE_ACTION.HANDOFF);
  assert.equal(reason, ATTENDANCE_HANDOFF_REASON.PRICE);
  assert.match(reply, /helix não está na nossa tabela/u);
  assert.doesNotMatch(reply, /R\$\d/u);
});

test("caso real 002: estado estruturado reconstrói o lead a partir do log", () => {
  const state = deriveAttendanceState(CASE_002_MESSAGES);
  assert.equal(state.service_type, SERVICE_TYPE.PIERCING);
  assert.equal(state.piercing_type, "segundo_furo");
  assert.equal(state.piercing_location, "orelha esquerda");
  assert.equal(state.requested_date.label, "amanhã");
  assert.equal(state.requested_date.date, "2026-09-26");
  assert.equal(state.requested_period, "tarde");
  assert.equal(state.price_status, PRICE_STATUS.AVAILABLE);
  assert.equal(state.availability_status, AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION);
  assert.equal(state.pending_action, PENDING_ACTION.CONFIRM_AVAILABILITY);
  assert.equal(state.loop_detected, true);
});

test("caso real 002: em nenhum turno o agente repete os erros de produção", () => {
  CASE_002_MESSAGES.forEach((message, index) => {
    if (message.role !== "user") return;
    const state = deriveAttendanceState(CASE_002_MESSAGES.slice(0, index + 1));
    const decision = decideAttendanceTurn(state);
    const reply = decision.action === ATTENDANCE_ACTION.HANDOFF
      ? buildHandoffReply({ state, reason: decision.reason, handoffOk: true })
      : decision.reply;
    if (!reply) return;
    assert.equal(isPromise(reply), false, reply);
    if (state.service_type === SERVICE_TYPE.PIERCING) assert.doesNotMatch(reply, TATTOO_PRICE);
    for (const forbidden of CASE_002_FORBIDDEN_REPLIES) assert.notEqual(reply, forbidden);
  });
});

test("caso real 002: a primeira pergunta de horário já escala com preço (não depois de 4h)", () => {
  const index = CASE_002_MESSAGES.findIndex((message) => message.content === "oi, vcs atendem amanhã?");
  const state = deriveAttendanceState(CASE_002_MESSAGES.slice(0, index + 1));
  assert.equal(decideAttendanceTurn(state).action, ATTENDANCE_ACTION.HANDOFF);
});

test("8/PROBLEMA 8. resumo operacional do caso real", () => {
  const summary = buildOperationalSummary(deriveAttendanceState(CASE_002_MESSAGES));
  const fields = Object.fromEntries(summary.fields.map((field) => [field.label, field.value]));
  assert.equal(summary.needsHuman, true);
  assert.equal(summary.headline, "ATENDIMENTO HUMANO NECESSÁRIO");
  assert.equal(fields["SERVIÇO"], "piercing");
  assert.equal(fields["PROCEDIMENTO"], "segundo furo");
  assert.equal(fields["LOCAL"], "orelha esquerda");
  assert.equal(fields["DATA"], "amanhã (26/09)");
  assert.equal(fields["PERÍODO"], "tarde");
  assert.equal(fields["PREÇO"], "tabela disponível");
  assert.equal(fields["DISPONIBILIDADE"], "aguardando confirmação");
  assert.equal(fields["AÇÃO"], "confirmar horário");
  assert.match(summary.reason, /Cliente quer segundo furo \(orelha esquerda\) amanhã \(26\/09\) à tarde\. Preço disponível\. Falta confirmar disponibilidade\./u);
  assert.deepEqual(summary.commercialContext, ["aço R$60", "titânio a partir de R$80"]);
});

test("resposta humana com preço resolve promessas pendentes", () => {
  const state = deriveAttendanceState([
    ...CASE_002_MESSAGES,
    { role: "assistant", content: "Boa noite, Leandro. Aqui é o Coringa. Para o segundo furo, o valor é R$60 com aço ou a partir de R$80 com titânio. Sobre amanhã à tarde, preciso apenas alinhar o horário." }
  ]);
  assert.equal(state.price_status, PRICE_STATUS.INFORMED);
  assert.equal(state.unresolved_promises, 0);
  assert.equal(state.availability_status, AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION);
});

test("horário concreto respondido resolve a disponibilidade; texto genérico não", () => {
  const base = [
    { role: "user", content: "piercing amanhã à tarde, tem horário?" },
    { role: "assistant", content: "Atendemos sempre com horário agendado, das 10h às 20h." }
  ];
  assert.equal(deriveAttendanceState(base).availability_status, AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION);
  const resolved = deriveAttendanceState([...base, { role: "assistant", content: "Consigo às 15h com a Jennyfer, pode ser?" }]);
  assert.equal(resolved.availability_status, AVAILABILITY_STATUS.RESOLVED);
});

test("buildHandoffReply só afirma registro quando o handoff realmente aconteceu", () => {
  const state = deriveAttendanceState([{ role: "user", content: "piercing amanhã de manhã, tem vaga?" }]);
  assert.equal(state.requested_period, "manhã");
  assert.match(buildHandoffReply({ state, reason: "AVAILABILITY_CONFIRMATION", handoffOk: true }), /registrado com a equipe/u);
  assert.doesNotMatch(buildHandoffReply({ state, reason: "AVAILABILITY_CONFIRMATION", handoffOk: false }), /registrado com a equipe/u);
});
