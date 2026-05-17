import test from "node:test";
import assert from "node:assert/strict";

import { V2_MEMORY_WRITERS, describeV2Integration } from "../src/v2-integration.js";

test("v2 integration descriptor covers required JSONL kinds with stable owners and writers", () => {
  const description = describeV2Integration();
  const expectedKinds = [
    "decisions",
    "permission-transitions",
    "block-resets",
    "research",
    "oss-installations",
    "oss-rejected",
    "oss-pending-merge",
    "oss-protected-deferred",
    "halt-reason",
    "ccusage-shape-changes",
    "progress"
  ];

  assert.deepEqual(
    V2_MEMORY_WRITERS.map((entry) => entry.kind),
    expectedKinds
  );
  assert.equal(new Set(V2_MEMORY_WRITERS.map((entry) => entry.kind)).size, expectedKinds.length);

  assert.deepEqual(description.kinds, expectedKinds);
  assert.equal(description.version, 2);

  assert.deepEqual(description.byKind.decisions, {
    kind: "decisions",
    ownerModule: "reasoning-decider",
    writerModules: ["reasoning-decider", "cli"],
    responsibility: "Claude model and Codex effort decisions"
  });
  assert.deepEqual(description.byKind["permission-transitions"], {
    kind: "permission-transitions",
    ownerModule: "token-guard",
    writerModules: ["token-guard"],
    responsibility: "authority mode transitions and verification exceptions"
  });
  assert.deepEqual(description.byKind["block-resets"], {
    kind: "block-resets",
    ownerModule: "token-guard",
    writerModules: ["token-guard"],
    responsibility: "ccusage block reset detection decisions"
  });
  assert.deepEqual(description.byKind.research, {
    kind: "research",
    ownerModule: "oss-explorer",
    writerModules: ["oss-explorer"],
    responsibility: "OSS research findings and candidate evaluation context"
  });
  assert.deepEqual(description.byKind["oss-installations"], {
    kind: "oss-installations",
    ownerModule: "oss-explorer",
    writerModules: ["oss-explorer"],
    responsibility: "accepted sandbox installations"
  });
  assert.deepEqual(description.byKind["oss-rejected"], {
    kind: "oss-rejected",
    ownerModule: "oss-explorer",
    writerModules: ["oss-explorer"],
    responsibility: "rejected OSS candidates"
  });
  assert.deepEqual(description.byKind["oss-pending-merge"], {
    kind: "oss-pending-merge",
    ownerModule: "oss-explorer",
    writerModules: ["oss-explorer"],
    responsibility: "review-required OSS candidates awaiting merge"
  });
  assert.deepEqual(description.byKind["oss-protected-deferred"], {
    kind: "oss-protected-deferred",
    ownerModule: "oss-explorer",
    writerModules: ["oss-explorer"],
    responsibility: "OSS candidates deferred for protected file or package sections"
  });
  assert.deepEqual(description.byKind["halt-reason"], {
    kind: "halt-reason",
    ownerModule: "autonomous-loop",
    writerModules: ["autonomous-loop"],
    responsibility: "autonomous halt and safety guard triggers"
  });
  assert.deepEqual(description.byKind["ccusage-shape-changes"], {
    kind: "ccusage-shape-changes",
    ownerModule: "token-guard",
    writerModules: ["token-guard"],
    responsibility: "sanitized ccusage schema drift notifications"
  });
  assert.deepEqual(description.byKind.progress, {
    kind: "progress",
    ownerModule: "progress",
    writerModules: ["progress"],
    responsibility: "human and machine progress checkpoints"
  });
});
