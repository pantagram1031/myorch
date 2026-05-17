export function decideClaudeModel(mode) {
    if (mode === "normal") {
        return {
            allowed: true,
            model: "opus",
            reason: "Authority mode normal allows Claude opus for full-capability autonomous work."
        };
    }
    if (mode === "efficient") {
        return {
            allowed: true,
            model: "sonnet",
            reason: "Authority mode efficient allows Claude sonnet to conserve usage while keeping Claude available."
        };
    }
    if (mode === "codex-leaning") {
        return {
            allowed: true,
            model: "haiku",
            reason: "Authority mode codex-leaning restricts Claude to haiku for approval-only triggers."
        };
    }
    return {
        allowed: false,
        reason: `Authority mode ${mode} disables autonomous Claude model selection.`
    };
}
export function decideCodexEffort(input) {
    if (!input.supportsReasoningEffort) {
        return {
            effort: "unavailable",
            reason: "Codex reasoning effort is unavailable because this CLI does not support the flag."
        };
    }
    if (input.remainingPercent > 40) {
        return {
            effort: "high",
            reason: "Codex reasoning effort set to high because remaining percent is above 40."
        };
    }
    if (input.remainingPercent >= 20) {
        return {
            effort: "medium",
            reason: "Codex reasoning effort set to medium because remaining percent is between 20 and 40."
        };
    }
    return {
        effort: "low",
        reason: "Codex reasoning effort set to low because remaining percent is below 20."
    };
}
