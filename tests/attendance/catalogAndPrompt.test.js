import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STUDIO_CATALOG, piercingPriceOptions } from "../../config/business/catalog.js";
import { OFFICIAL_PRICING } from "../../modules/pricing/pricingEngine.js";
import { montarPromptSistema } from "../../services/ai/prompts.js";
import { deriveAttendanceState } from "../../modules/attendance/attendanceState.js";

test("catálogo contém os valores base atuais de piercing", () => {
  assert.deepEqual(piercingPriceOptions("segundo_furo").map((o) => [o.material, o.amount, o.from]), [["aco", 60, false], ["titanio", 80, true]]);
  assert.deepEqual(piercingPriceOptions("ponto_de_luz_micro").map((o) => [o.material, o.amount]), [["titanio", 90]]);
  assert.equal(STUDIO_CATALOG.piercing.deposit.amount, 40);
  assert.equal(STUDIO_CATALOG.piercing.deposit.deductedFromTotal, true);
});

test("catálogo é imutável em runtime", () => {
  assert.throws(() => { STUDIO_CATALOG.piercing.deposit.amount = 1; }, TypeError);
});

test("motor de preço de tattoo lê do catálogo (fonte única)", () => {
  assert.equal(OFFICIAL_PRICING.minimum.amount, STUDIO_CATALOG.tattoo.minimum);
  assert.equal(OFFICIAL_PRICING.deposit.amount, STUDIO_CATALOG.tattoo.deposit.amount);
  assert.equal(OFFICIAL_PRICING.sessions[3].amount, STUDIO_CATALOG.tattoo.sessions[3]);
  assert.equal(OFFICIAL_PRICING.sessions[6].amount, STUDIO_CATALOG.tattoo.sessions[6]);
});

test("prompt não manda mais prometer consulta à Jennyfer", () => {
  const prompt = montarPromptSistema("Ana");
  assert.doesNotMatch(prompt, /diga que vai confirmar com a Jennyfer/u);
  assert.doesNotMatch(prompt, /Não invente preço ou horário de piercing - isso é confirmado pela Jennyfer/u);
  assert.match(prompt, /Segundo furo: aço R\$60; titânio a partir de R\$80/u);
  assert.match(prompt, /Ponto de luz micro: titânio R\$90/u);
  assert.match(prompt, /R\$40 por aplicação/u);
  assert.match(prompt, /Promessas proibidas/u);
  assert.match(prompt, /Valor mínimo da tatuagem: R\$150/u);
  assert.match(prompt, /sinal de R\$100/u);
});

test("prompt recebe o estado estruturado quando disponível", () => {
  const attendanceState = deriveAttendanceState([{ role: "user", content: "quero o segundo furo na orelha esquerda" }]);
  const prompt = montarPromptSistema("Ana", { attendanceState });
  assert.match(prompt, /ESTADO ESTRUTURADO DO ATENDIMENTO/u);
  assert.match(prompt, /SERVIÇO: piercing/u);
  assert.match(prompt, /O assunto atual é PIERCING/u);
  assert.doesNotMatch(montarPromptSistema("Ana"), /ESTADO ESTRUTURADO DO ATENDIMENTO/u);
});

test("valores de piercing não estão hardcoded fora do catálogo", async () => {
  for (const file of ["../../services/ai/prompts.js", "../../modules/attendance/attendancePolicy.js", "../../modules/attendance/operationalSummary.js", "../../api/meta.js"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /R\$ ?(60|80|90|40)\b/u, file);
  }
});
