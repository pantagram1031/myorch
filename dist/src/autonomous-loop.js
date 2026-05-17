export function chooseNextGoal(input) {
    const firstUnfinished = input.roadmap
        .split(/\r?\n/)
        .find((line) => {
        if (!line.trimStart().startsWith("- [ ]"))
            return false;
        return roadmapTaskTitle(line).length > 0;
    });
    const task = (firstUnfinished ? roadmapTaskTitle(firstUnfinished) : undefined) ??
        "Review ROADMAP and report no unfinished tasks";
    const latestInsight = input.latestInsight.trim().slice(0, 200);
    return `autonomous start: ${task}. Mode=${input.mode}. Latest insight: ${latestInsight}`;
}
function roadmapTaskTitle(line) {
    return line.replace(/^\s*-\s\[\s\]\s*/, "").trim();
}
export function evaluateSafetyGuards(input) {
    if (input.tokenPercent >= 92) {
        return { halt: true, reason: "token percent >= 92" };
    }
    if (input.cycleCount >= 50) {
        return { halt: true, reason: "cycle count >= 50" };
    }
    if (input.consecutivePriorityFailures >= 3) {
        return { halt: true, reason: "consecutive priority failures >= 3" };
    }
    if (input.pushFailures >= 5) {
        return { halt: true, reason: "push failures >= 5" };
    }
    if (input.roadmapComplete) {
        return { halt: true, reason: "roadmap complete" };
    }
    if (input.protectedFileAttempt) {
        return { halt: true, reason: "protected file attempt" };
    }
    return { halt: false, reason: "guards clear" };
}
export function assertClaudeAllowedForAutonomy(mode, env) {
    const envTestMode = env.MYORCH_TEST_MODE === "1";
    if (envTestMode) {
        return {
            allowed: false,
            reason: "autonomous runtime must not set MYORCH_TEST_MODE",
            mode,
            envTestMode
        };
    }
    if (mode === "claude-paused" || mode === "halt") {
        return {
            allowed: false,
            reason: `autonomous Claude disabled for authority mode ${mode}`,
            mode,
            envTestMode
        };
    }
    return {
        allowed: true,
        reason: `autonomous Claude allowed for authority mode ${mode}`,
        mode,
        envTestMode
    };
}
