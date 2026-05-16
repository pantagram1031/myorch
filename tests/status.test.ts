import test from "node:test";
import assert from "node:assert/strict";
import { formatProgress, formatStatusLine, statusLineInputFromSession, summarizePlanStatus } from "../src/status.js";

const samplePlan = [
  "- [x] **Task 1: Done**",
  "  - Verifier: `npm test task1`",
  "- [ ] ← current **Task 2: Current**",
  "  - Verifier: `npm test task2`",
  "- [ ] **Task 3: Next**",
  "  - Verifier: `npm test task3`"
].join("\n");

const allDonePlan = [
  "- [x] **Task 1: Done**",
  "- [x] **Task 2: Also Done**"
].join("\n");

test("status formatProgress returns correct counts and current title", () => {
  const result = formatProgress(samplePlan);
  assert.equal(result, "[1/3 done] Current: Current");
});

test("status formatProgress shows none when all tasks are done", () => {
  const result = formatProgress(allDonePlan);
  assert.equal(result, "[2/2 done] Current: none");
});

test("status summarizePlanStatus returns remaining count and current title", () => {
  const status = summarizePlanStatus(samplePlan);
  assert.equal(status.remaining, 2);
  assert.equal(status.current, "Current");
});

test("status falls back to first unchecked task and strips legacy current marker", () => {
  const plan = "- [ ] ??current **Task 4: Compact survival**\n  - Verifier: `npm test`\n";

  assert.equal(formatProgress(plan), "[0/1 done] Current: Compact survival");
  assert.deepEqual(summarizePlanStatus(plan), { remaining: 1, current: "Compact survival" });
});

test("formatStatusLine prints model cost block burn context and ratchet task", () => {
  const line = formatStatusLine({
    model: "Opus",
    costUsd: 1.25,
    blockRemainingMinutes: 42,
    burnRateTokensPerMinute: 320,
    contextPercent: 76,
    progress: "[1/3 done] Current: Current"
  });

  assert.match(line, /Opus/);
  assert.match(line, /\$1\.25/);
  assert.match(line, /42m/);
  assert.match(line, /320 tok\/min/);
  assert.match(line, /76%/);
  assert.match(line, /WARNING/);
  assert.match(line, /\[1\/3 done\] Current: Current/);
});

test("statusLineInputFromSession reads real ccusage block fields", () => {
  const input = statusLineInputFromSession(
    { model: { display_name: "Opus" }, cost: { total_cost_usd: 3 }, context_window: { used_percentage: 55 } },
    samplePlan,
    {
      blocks: [
        {
          isActive: true,
          projection: { remainingMinutes: 54 },
          burnRate: { tokensPerMinute: 6596.2 }
        }
      ]
    }
  );

  assert.equal(input.blockRemainingMinutes, 54);
  assert.equal(input.burnRateTokensPerMinute, 6596.2);
});
