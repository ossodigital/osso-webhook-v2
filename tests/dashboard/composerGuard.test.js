import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { acaoDaTecla, criarComposer, validarRascunho } from "../../dashboard/composerGuard.js";
import { validateManualMessage } from "../../services/attendance/manualMessagePolicy.js";
import { WHATSAPP_PROVIDER_CAPABILITIES } from "../../services/meta/whatsapp.js";

const dashboardHtml = await readFile(new URL("../../dashboard/index.html", import.meta.url), "utf8");
const metaSource = await readFile(new URL("../../api/meta.js", import.meta.url), "utf8");
const whatsappSource = await readFile(new URL("../../services/meta/whatsapp.js", import.meta.url), "utf8");

function composerComContador({ confirmar = () => true, resposta = { ok: true } } = {}) {
  const enviados = [];
  let liberar;
  const composer = criarComposer({
    confirmar,
    enviar: (texto, opcoes) => {
      enviados.push({ texto, opcoes });
      return new Promise((resolve) => { liberar = () => resolve(resposta); });
    }
  });
  return { composer, enviados, liberar: () => liberar() };
}

test("9. Enter é nova linha, nunca envio", () => {
  assert.equal(acaoDaTecla({ key: "Enter" }), "nova_linha");
  assert.equal(acaoDaTecla({ key: "Enter", shiftKey: true }), "nova_linha");
  // O dashboard não tem mais handler de Enter que chama o envio.
  assert.doesNotMatch(dashboardHtml, /event\.key === "Enter"[\s\S]{0,120}enviarMensagemManual/u);
  assert.doesNotMatch(dashboardHtml, /"keydown",\s*function\(event\) \{\s*if \(\s*event\.key === "Enter"/u);
});

test("9b. mensagem multi-linha é enviada inteira, com quebras preservadas", async () => {
  const { composer, enviados, liberar } = composerComContador();
  const texto = "Boa noite Leandro, tudo bem?\nAqui é o Coringa.\n\nSegundo furo: aço R$60.";
  composer.revisar(texto);
  const envio = composer.enviar(texto);
  liberar();
  await envio;
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].texto, texto);
});

test("10. mensagem vazia é bloqueada", async () => {
  assert.equal(validarRascunho("   \n ").status, "vazio");
  const { composer, enviados } = composerComContador();
  assert.equal(composer.revisar("  ").ok, false);
  assert.deepEqual(await composer.enviar("  "), { ok: false, motivo: "vazio" });
  assert.equal(enviados.length, 0);
});

test("10b. 1 caractere acidental exige confirmação explícita", async () => {
  const recusa = composerComContador({ confirmar: () => false });
  assert.equal(recusa.composer.revisar("O").curto, true);
  assert.deepEqual(await recusa.composer.enviar("O"), { ok: false, motivo: "curto_cancelado" });
  assert.equal(recusa.enviados.length, 0);

  const aceita = composerComContador({ confirmar: () => true });
  aceita.composer.revisar("Ok");
  const envio = aceita.composer.enviar("Ok");
  aceita.liberar();
  await envio;
  assert.equal(aceita.enviados[0].opcoes.confirmShort, true);
});

test("10c. não envia sem revisar, nem texto alterado depois da revisão", async () => {
  const { composer, enviados } = composerComContador();
  assert.deepEqual(await composer.enviar("Mensagem completa"), { ok: false, motivo: "revisar" });
  composer.revisar("Mensagem completa");
  assert.deepEqual(await composer.enviar("Mensagem completa editada"), { ok: false, motivo: "revisar" });
  assert.equal(enviados.length, 0);
});

test("11. duplo toque em Enviar gera uma única mensagem", async () => {
  const { composer, enviados, liberar } = composerComContador();
  composer.revisar("Boa noite, Leandro!");
  const primeiro = composer.enviar("Boa noite, Leandro!");
  const segundo = composer.enviar("Boa noite, Leandro!");
  assert.equal(primeiro, segundo);
  liberar();
  await Promise.all([primeiro, segundo]);
  assert.equal(enviados.length, 1);
  // Após o envio a revisão é consumida: um terceiro toque não reenvia.
  assert.deepEqual(await composer.enviar("Boa noite, Leandro!"), { ok: false, motivo: "revisar" });
  assert.equal(enviados.length, 1);
});

test("11b. servidor também bloqueia vazio, curto sem confirmação e reenvio idêntico imediato", () => {
  const now = Date.parse("2026-09-26T02:45:10Z");
  assert.equal(validateManualMessage({ message: " " }).status, 400);
  assert.equal(validateManualMessage({ message: "O" }).status, 422);
  assert.equal(validateManualMessage({ message: "O", confirmShort: true }).ok, true);
  const lastAssistant = { content: "Boa noite, Leandro!", created_at: "2026-09-26T02:45:00Z" };
  assert.equal(validateManualMessage({ message: "Boa noite, Leandro!", lastAssistant, now }).duplicate, true);
  assert.equal(validateManualMessage({ message: "Boa noite, Leandro!", lastAssistant, now, allowDuplicate: true }).duplicate, false);
  assert.equal(validateManualMessage({ message: "Boa noite, Leandro!", lastAssistant, now: now + 60_000 }).duplicate, false);
  assert.match(metaSource, /validateManualMessage\(\{/u);
});

test("12/13. delete remoto NÃO suportado pela Meta Cloud API => sem ação enganosa", () => {
  assert.equal(WHATSAPP_PROVIDER_CAPABILITIES.provider, "META_CLOUD_API");
  assert.equal(WHATSAPP_PROVIDER_CAPABILITIES.deleteSentMessage, false);
  assert.doesNotMatch(whatsappSource, /export async function (apagar|deletar|delete|revogar|revoke)/iu);
  assert.doesNotMatch(dashboardHtml, /apagar para todos<\/button>|deleteMessage|revokeMessage|debug=delete-message/iu);
  assert.doesNotMatch(metaSource, /"delete-message"/u);
  assert.match(dashboardHtml, /não pode ser apagada/u);
});

test("dashboard: revisão é invalidada ao editar e ao trocar de lead", () => {
  assert.match(dashboardHtml, /msgInput\.addEventListener\(\s*"input"[\s\S]{0,160}fecharRevisao\(\)/u);
  assert.match(dashboardHtml, /if \(phone !== selectedPhone\) fecharRevisao\(\);/u);
  assert.match(dashboardHtml, /composerReviewPhone !== selectedPhone/u);
});
