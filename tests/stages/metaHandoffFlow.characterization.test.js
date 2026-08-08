import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const metaSource = await readFile(new URL("../../api/meta.js", import.meta.url), "utf8");

test("api/meta classifica a mensagem do cliente antes da IA", () => {
  assert.match(metaSource, /let stage = detectarStage\(userText, existingLead\?\.stage\)/);
});

test("api/meta reclassifica userText depois da IA, não a resposta da IA", () => {
  assert.match(metaSource, /const newStage = detectarStage\(userText, stage\)/);
  assert.doesNotMatch(metaSource, /detectarStage\(reply[,)\s]/);
});

test("a resposta fixa de handoff depende de newStage humano", () => {
  assert.match(
    metaSource,
    /if \(newStage === "humano"\) \{\s*reply = `Perfeito, \$\{leadName\}!/
  );
});

test("lead humano existente bloqueia a IA antes do processamento conversacional", () => {
  const humanGuardIndex = metaSource.indexOf('existingLead?.stage === "humano"');
  const aiCallIndex = metaSource.indexOf("gerarRespostaAtendimento({", humanGuardIndex);
  assert.ok(humanGuardIndex >= 0);
  assert.ok(aiCallIndex > humanGuardIndex);
});
