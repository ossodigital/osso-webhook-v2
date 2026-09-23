import test from "node:test";
import assert from "node:assert/strict";
import { mergeLeadsPage, atualizarPrimeiraPagina } from "../../dashboard/leadsPagination.js";

function lead(phone, overrides = {}) {
  return { phone, name: phone, stage: "novo", updated_at: "2026-09-20T00:00:00Z", ...overrides };
}

test("mergeLeadsPage com base vazia e pagina vazia retorna vazio", () => {
  assert.deepEqual(mergeLeadsPage([], []), []);
});

test("mergeLeadsPage anexa leads novos preservando ordem", () => {
  const carregados = [lead("A"), lead("B")];
  const pagina2 = [lead("C"), lead("D")];
  const resultado = mergeLeadsPage(carregados, pagina2);
  assert.deepEqual(resultado.map((l) => l.phone), ["A", "B", "C", "D"]);
});

test("mergeLeadsPage nao duplica lead que ja estava carregado", () => {
  const carregados = [lead("A"), lead("B")];
  const paginaComRepetido = [lead("B"), lead("C")];
  const resultado = mergeLeadsPage(carregados, paginaComRepetido);
  assert.deepEqual(resultado.map((l) => l.phone), ["A", "B", "C"]);
});

test("mergeLeadsPage sem novos leads mantem lista igual", () => {
  const carregados = [lead("A"), lead("B")];
  const resultado = mergeLeadsPage(carregados, [lead("A"), lead("B")]);
  assert.equal(resultado.length, 2);
});

test("atualizarPrimeiraPagina substitui dados da primeira pagina e preserva o resto", () => {
  const carregados = [lead("A", { stage: "novo" }), lead("B"), lead("C")];
  const paginaAtualizada = [lead("A", { stage: "humano" })];
  const resultado = atualizarPrimeiraPagina(carregados, paginaAtualizada);
  assert.deepEqual(resultado.map((l) => l.phone), ["A", "B", "C"]);
  assert.equal(resultado[0].stage, "humano");
});

test("atualizarPrimeiraPagina remove do restante um lead que migrou para a primeira pagina", () => {
  const carregados = [lead("A"), lead("B"), lead("C")];
  const paginaAtualizada = [lead("C", { stage: "humano" }), lead("A")];
  const resultado = atualizarPrimeiraPagina(carregados, paginaAtualizada);
  assert.deepEqual(resultado.map((l) => l.phone), ["C", "A", "B"]);
});

test("atualizarPrimeiraPagina com base vazia so retorna a pagina atualizada", () => {
  const resultado = atualizarPrimeiraPagina([], [lead("A")]);
  assert.deepEqual(resultado.map((l) => l.phone), ["A"]);
});
