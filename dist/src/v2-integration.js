export const V2_MEMORY_WRITERS = [
    {
        kind: "decisions",
        ownerModule: "reasoning-decider",
        writerModules: ["reasoning-decider", "cli"],
        responsibility: "Claude model and Codex effort decisions"
    },
    {
        kind: "permission-transitions",
        ownerModule: "token-guard",
        writerModules: ["token-guard"],
        responsibility: "authority mode transitions and verification exceptions"
    },
    {
        kind: "block-resets",
        ownerModule: "token-guard",
        writerModules: ["token-guard"],
        responsibility: "ccusage block reset detection decisions"
    },
    {
        kind: "research",
        ownerModule: "oss-explorer",
        writerModules: ["oss-explorer"],
        responsibility: "OSS research findings and candidate evaluation context"
    },
    {
        kind: "oss-installations",
        ownerModule: "oss-explorer",
        writerModules: ["oss-explorer"],
        responsibility: "accepted sandbox installations"
    },
    {
        kind: "oss-rejected",
        ownerModule: "oss-explorer",
        writerModules: ["oss-explorer"],
        responsibility: "rejected OSS candidates"
    },
    {
        kind: "oss-pending-merge",
        ownerModule: "oss-explorer",
        writerModules: ["oss-explorer"],
        responsibility: "review-required OSS candidates awaiting merge"
    },
    {
        kind: "oss-protected-deferred",
        ownerModule: "oss-explorer",
        writerModules: ["oss-explorer"],
        responsibility: "OSS candidates deferred for protected file or package sections"
    },
    {
        kind: "halt-reason",
        ownerModule: "autonomous-loop",
        writerModules: ["autonomous-loop"],
        responsibility: "autonomous halt and safety guard triggers"
    },
    {
        kind: "ccusage-shape-changes",
        ownerModule: "token-guard",
        writerModules: ["token-guard"],
        responsibility: "sanitized ccusage schema drift notifications"
    },
    {
        kind: "progress",
        ownerModule: "progress",
        writerModules: ["progress"],
        responsibility: "human and machine progress checkpoints"
    }
];
export function describeV2Integration() {
    const byKind = Object.fromEntries(V2_MEMORY_WRITERS.map((entry) => [entry.kind, entry]));
    return {
        version: 2,
        kinds: V2_MEMORY_WRITERS.map((entry) => entry.kind),
        byKind
    };
}
