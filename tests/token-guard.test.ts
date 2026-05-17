import test from "node:test";
import assert from "node:assert/strict";
import {
  decideAuthorityMode,
  detectBlockReset,
  recordCcusageShapeMiss
} from "../src/token-guard.js";

test("token guard maps ccusage percent to authority modes", () => {
  assert.equal(decideAuthorityMode({ percent: 49 }).mode, "normal");
  assert.equal(decideAuthorityMode({ percent: 50 }).mode, "efficient");
  assert.equal(decideAuthorityMode({ percent: 66 }).mode, "codex-leaning");
  assert.equal(decideAuthorityMode({ percent: 70 }).mode, "claude-paused");
  assert.equal(decideAuthorityMode({ percent: 92 }).mode, "halt");
});

test("claude-paused blocks autonomous Claude calls and still allows ccusage", () => {
  const decision = decideAuthorityMode({ percent: 71 });

  assert.equal(decision.allowClaudeAutonomous, false);
  assert.equal(decision.allowCcusage, true);
  assert.equal(decision.allowCodex, true);
  assert.equal(decision.shouldHalt, false);
});

test("verification exception budget overflow is reported with a dedicated reason", () => {
  const decision = decideAuthorityMode({
    percent: 74,
    verificationBudget: {
      callsUsed: 3,
      tokensUsed: 600,
      maxCalls: 2,
      maxTokens: 500
    }
  });

  assert.equal(decision.mode, "claude-paused");
  assert.equal(decision.allowVerificationException, false);
  assert.equal(decision.reason, "verification-exception-budget-exceeded");
});

test("verification exception is denied when no budget is provided in claude-paused mode", () => {
  const decision = decideAuthorityMode({ percent: 74 });

  assert.equal(decision.mode, "claude-paused");
  assert.equal(decision.allowVerificationException, false);
  assert.equal(decision.reason, "verification-exception-budget-missing");
});

test("block reset uses block id with high confidence", () => {
  const reset = detectBlockReset(
    { percent: 74, blockId: "old", observedAt: "2026-05-17T00:00:00.000Z" },
    { percent: 2, blockId: "new", observedAt: "2026-05-17T00:05:00.000Z" }
  );

  assert.deepEqual(reset, { reset: true, confidence: "high", reason: "active block id changed" });
});

test("block reset uses window change with medium confidence when block shape exposes it", () => {
  const reset = detectBlockReset(
    {
      percent: 74,
      startTime: "2026-05-17T00:00:00.000Z",
      endTime: "2026-05-17T05:00:00.000Z",
      observedAt: "2026-05-17T01:00:00.000Z"
    },
    {
      percent: 5,
      startTime: "2026-05-17T05:00:00.000Z",
      endTime: "2026-05-17T10:00:00.000Z",
      observedAt: "2026-05-17T05:01:00.000Z"
    }
  );

  assert.deepEqual(reset, { reset: true, confidence: "medium", reason: "active block window changed" });
});

test("block reset uses low confidence after a large percent drop and time gap", () => {
  const reset = detectBlockReset(
    { percent: 72, observedAt: "2026-05-17T00:00:00.000Z" },
    { percent: 10, observedAt: "2026-05-17T04:01:00.000Z" }
  );

  assert.equal(reset.reset, true);
  assert.equal(reset.confidence, "low");
  assert.equal(reset.reason, "large percent drop after time gap");
});

test("block reset does not use low confidence below the configured drop threshold", () => {
  const reset = detectBlockReset(
    { percent: 72, observedAt: "2026-05-17T00:00:00.000Z" },
    { percent: 30, observedAt: "2026-05-17T04:01:00.000Z" }
  );

  assert.deepEqual(reset, { reset: false, reason: "no reset signal" });
});

test("block reset does not use low confidence for stale out-of-order snapshots", () => {
  const reset = detectBlockReset(
    { percent: 80, observedAt: "2026-05-17T08:00:00.000Z" },
    { percent: 20, observedAt: "2026-05-17T00:00:00.000Z" }
  );

  assert.deepEqual(reset, { reset: false, reason: "no reset signal" });
});

test("schema drift reaches notification threshold after three misses", () => {
  const first = recordCcusageShapeMiss({ count: 0 }, { unexpected: true });
  const second = recordCcusageShapeMiss(first.state, { unexpected: true });
  const third = recordCcusageShapeMiss(second.state, { unexpected: true });

  assert.equal(first.shouldNotify, false);
  assert.equal(second.shouldNotify, false);
  assert.equal(third.shouldNotify, true);
  assert.equal(third.state.count, 3);
  assert.match(third.sanitized, /unexpected/);
});

test("schema drift sanitizes user paths and secret-like fields", () => {
  const result = recordCcusageShapeMiss(
    { count: 2 },
    { home: "C:\\Users\\Alice\\secret", apiKey: "abc123", nested: { token: "secret-token" } }
  );

  assert.equal(result.shouldNotify, true);
  assert.doesNotMatch(result.sanitized, /Alice/);
  assert.doesNotMatch(result.sanitized, /abc123/);
  assert.doesNotMatch(result.sanitized, /secret-token/);
  assert.match(result.sanitized, /\[redacted/);
});
