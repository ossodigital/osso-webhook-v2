import test from "node:test";
import assert from "node:assert/strict";
import detectarStage from "../../modules/stages/stageDetector.js";
import { CASE_001_ALLEF } from "../fixtures/case-001-allef.js";
import {
  HANDOFF_AUDIT_CASES,
  PREVIOUS_STAGES,
  expectedForPreviousStage
} from "../fixtures/handoff-audit-matrix.js";

for (const [input, baseStage] of HANDOFF_AUDIT_CASES) {
  for (const previousStage of PREVIOUS_STAGES) {
    test(`caracteriza: ${input} [anterior=${previousStage}]`, () => {
      const expectedStage = expectedForPreviousStage(baseStage, previousStage);
      const actualStage = detectarStage(input, previousStage);
      assert.equal(actualStage, expectedStage);
      assert.equal(actualStage === "humano", expectedStage === "humano");
    });
  }
}

test("entrada sem regra preserva o stage existente", () => {
  assert.equal(detectarStage("Gostei", "orcamento"), "orcamento");
});

test("CASE-001 Allef preserva orçamento sem handoff após a correção", () => {
  let finalStage = null;

  for (const step of CASE_001_ALLEF.steps) {
    finalStage = detectarStage(step.input, step.existingStage);
    assert.equal(finalStage, step.expectedStage, `${step.input}: stage divergente`);
  }

  assert.equal(finalStage, "orcamento");
  assert.equal(finalStage === "humano", CASE_001_ALLEF.expectedHandoff);
});
