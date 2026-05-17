export type V2MemoryKind =
  | "decisions"
  | "permission-transitions"
  | "block-resets"
  | "research"
  | "oss-installations"
  | "oss-rejected"
  | "oss-pending-merge"
  | "oss-protected-deferred"
  | "halt-reason"
  | "ccusage-shape-changes"
  | "progress";

export type V2OwnerModule =
  | "reasoning-decider"
  | "token-guard"
  | "autonomous-loop"
  | "oss-explorer"
  | "progress"
  | "cli";

export interface V2MemoryWriterDescriptor {
  kind: V2MemoryKind;
  ownerModule: V2OwnerModule;
  writerModules: V2OwnerModule[];
  responsibility: string;
}

export const V2_MEMORY_WRITERS: readonly V2MemoryWriterDescriptor[] = [
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
] as const;

export function describeV2Integration(): {
  version: 2;
  kinds: V2MemoryKind[];
  byKind: Record<V2MemoryKind, V2MemoryWriterDescriptor>;
} {
  const byKind = Object.fromEntries(
    V2_MEMORY_WRITERS.map((entry) => [entry.kind, entry])
  ) as Record<V2MemoryKind, V2MemoryWriterDescriptor>;

  return {
    version: 2,
    kinds: V2_MEMORY_WRITERS.map((entry) => entry.kind),
    byKind
  };
}
