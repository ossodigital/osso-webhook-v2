export function decideHandoff({ stage, handoff, compatibilityMode = true } = {}) {
  if (!compatibilityMode) {
    return { shouldHandoff: false, reason: null };
  }

  if (handoff?.compatibilityBlocked || !handoff?.compatibilityTrigger) {
    return { shouldHandoff: false, reason: null };
  }

  return {
    shouldHandoff: true,
    reason: handoff.candidates[0] || "LEGACY_COMPATIBILITY"
  };
}
