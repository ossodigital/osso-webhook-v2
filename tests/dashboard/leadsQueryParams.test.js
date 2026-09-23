import test from "node:test";
import assert from "node:assert/strict";
import { parseLeadsListParams, LEADS_PAGE_MAX, LEADS_PAGE_DEFAULT } from "../../services/supabase/leadsQueryParams.js";

test("sem parametros usa limit/offset padrao e sem filtros", () => {
  const result = parseLeadsListParams({});
  assert.equal(result.limit, LEADS_PAGE_DEFAULT);
  assert.equal(result.offset, 0);
  assert.equal(result.search, "");
  assert.equal(result.stage, "");
});

test("limit exatamente no maximo (100) e aceito", () => {
  assert.equal(parseLeadsListParams({ limit: "100" }).limit, LEADS_PAGE_MAX);
});

test("limit acima do maximo (101) e limitado a 100", () => {
  assert.equal(parseLeadsListParams({ limit: "101" }).limit, LEADS_PAGE_MAX);
});

test("limit exatamente 51 e aceito sem clamping", () => {
  assert.equal(parseLeadsListParams({ limit: "51" }).limit, 51);
});

test("limit invalido (0, negativo, nao numerico) cai no padrao", () => {
  assert.equal(parseLeadsListParams({ limit: "0" }).limit, LEADS_PAGE_DEFAULT);
  assert.equal(parseLeadsListParams({ limit: "-10" }).limit, LEADS_PAGE_DEFAULT);
  assert.equal(parseLeadsListParams({ limit: "abc" }).limit, LEADS_PAGE_DEFAULT);
});

test("offset negativo ou invalido cai em 0", () => {
  assert.equal(parseLeadsListParams({ offset: "-5" }).offset, 0);
  assert.equal(parseLeadsListParams({ offset: "abc" }).offset, 0);
});

test("offset valido para segunda pagina (50) e preservado", () => {
  assert.equal(parseLeadsListParams({ offset: "50" }).offset, 50);
});

test("offset para terceira pagina com base 100 leads (offset 100)", () => {
  assert.equal(parseLeadsListParams({ offset: "100" }).offset, 100);
});

test("search e limitado a 100 caracteres e aparado", () => {
  const longo = "a".repeat(150);
  const result = parseLeadsListParams({ search: `  ${longo}  ` });
  assert.equal(result.search.length, 100);
});

test("stage e propagado como string, vazio quando ausente", () => {
  assert.equal(parseLeadsListParams({ stage: "humano" }).stage, "humano");
  assert.equal(parseLeadsListParams({}).stage, "");
});
