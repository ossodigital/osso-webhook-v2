export function toLegacyStage({ stage, handoffDecision } = {}) {
  return handoffDecision?.shouldHandoff ? "humano" : stage;
}
