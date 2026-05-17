import test from "node:test";
import assert from "node:assert/strict";
import {
  assertClaudeAllowedForAutonomy,
  chooseNextGoal,
  evaluateSafetyGuards
} from "../src/autonomous-loop.js";

test("autonomous loop chooses first unfinished roadmap item and carries latest insight context", () => {
  const goal = chooseNextGoal({
    roadmap:
      "# ROADMAP\n\n## Priority 1 - Efficiency\n\n- [x] Done\n- [ ] Apply token percent policy automatically.\n- [ ] Generate autonomous /goal loop.\n",
    latestInsight:
      "# Usage Insight\n\nClaude block pressure is down after metareview consolidation.",
    mode: "normal"
  });

  assert.match(goal, /Apply token percent policy automatically\./);
  assert.match(goal, /Latest insight: # Usage Insight/i);
  assert.doesNotMatch(goal, /Generate autonomous \/goal loop/);
});

test("autonomous loop skips blank success criteria checkboxes in seeded roadmap", () => {
  const goal = chooseNextGoal({
    roadmap:
      "# ROADMAP\n\n## Priority 1 - Efficiency\n\n- [x] Apply token percent policy automatically.\n\n### Success criteria\n\n- [ ]\n\n- [ ] Detect 5h block reset and restore Claude authority.\n",
    latestInsight: "review",
    mode: "normal"
  });

  assert.match(goal, /Detect 5h block reset/);
  assert.doesNotMatch(goal, /autonomous start: \./);
});

test("autonomous loop reports roadmap completion when no unfinished items remain", () => {
  const goal = chooseNextGoal({
    roadmap: "# ROADMAP\n\n- [x] Detect reset.\n- [x] Generate autonomous /goal loop.\n",
    latestInsight: "# Usage Insight\n\nNo pending work.",
    mode: "efficient"
  });

  assert.match(goal, /no unfinished tasks/i);
  assert.match(goal, /Mode=efficient/);
});

test("safety guard halts on every configured autonomous limit", () => {
  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 92,
      cycleCount: 0,
      consecutivePriorityFailures: 0,
      pushFailures: 0,
      roadmapComplete: false
    }),
    { halt: true, reason: "token percent >= 92" }
  );

  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 10,
      cycleCount: 50,
      consecutivePriorityFailures: 0,
      pushFailures: 0,
      roadmapComplete: false
    }),
    { halt: true, reason: "cycle count >= 50" }
  );

  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 10,
      cycleCount: 3,
      consecutivePriorityFailures: 3,
      pushFailures: 0,
      roadmapComplete: false
    }),
    { halt: true, reason: "consecutive priority failures >= 3" }
  );

  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 10,
      cycleCount: 3,
      consecutivePriorityFailures: 0,
      pushFailures: 5,
      roadmapComplete: false
    }),
    { halt: true, reason: "push failures >= 5" }
  );

  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 10,
      cycleCount: 3,
      consecutivePriorityFailures: 0,
      pushFailures: 0,
      roadmapComplete: true
    }),
    { halt: true, reason: "roadmap complete" }
  );

  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 10,
      cycleCount: 3,
      consecutivePriorityFailures: 0,
      pushFailures: 0,
      roadmapComplete: false,
      protectedFileAttempt: true
    }),
    { halt: true, reason: "protected file attempt" }
  );
});

test("safety guard stays clear when no halt condition is met", () => {
  assert.deepEqual(
    evaluateSafetyGuards({
      tokenPercent: 91,
      cycleCount: 49,
      consecutivePriorityFailures: 2,
      pushFailures: 4,
      roadmapComplete: false,
      protectedFileAttempt: false
    }),
    { halt: false, reason: "guards clear" }
  );
});

test("autonomous Claude invocation is blocked in paused or halt modes", () => {
  const paused = assertClaudeAllowedForAutonomy("claude-paused", {});
  assert.equal(paused.allowed, false);
  assert.equal(paused.reason, "autonomous Claude disabled for authority mode claude-paused");
  assert.equal(paused.mode, "claude-paused");
  assert.equal(paused.envTestMode, false);

  const halted = assertClaudeAllowedForAutonomy("halt", {});
  assert.equal(halted.allowed, false);
  assert.equal(halted.reason, "autonomous Claude disabled for authority mode halt");
  assert.equal(halted.mode, "halt");
});

test("autonomous Claude invocation rejects MYORCH_TEST_MODE even when Claude would otherwise be allowed", () => {
  const blocked = assertClaudeAllowedForAutonomy("normal", { MYORCH_TEST_MODE: "1" });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "autonomous runtime must not set MYORCH_TEST_MODE");
  assert.equal(blocked.mode, "normal");
  assert.equal(blocked.envTestMode, true);
});

test("autonomous Claude invocation allows normal runtime without mutating env", () => {
  const env = { PATH: "C:\\Windows\\System32" };
  const allowed = assertClaudeAllowedForAutonomy("efficient", env);

  assert.deepEqual(allowed, {
    allowed: true,
    reason: "autonomous Claude allowed for authority mode efficient",
    mode: "efficient",
    envTestMode: false
  });
  assert.deepEqual(env, { PATH: "C:\\Windows\\System32" });
});
