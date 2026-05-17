import test from "node:test";
import assert from "node:assert/strict";
import { decideClaudeModel, decideCodexEffort } from "../src/reasoning-decider.js";

test("Claude model follows authority mode", () => {
  const normal = decideClaudeModel("normal");
  assert.equal(normal.allowed, true);
  assert.equal(normal.model, "opus");
  assert.match(normal.reason, /normal/i);

  const efficient = decideClaudeModel("efficient");
  assert.equal(efficient.allowed, true);
  assert.equal(efficient.model, "sonnet");
  assert.match(efficient.reason, /efficient/i);

  const codexLeaning = decideClaudeModel("codex-leaning");
  assert.equal(codexLeaning.allowed, true);
  assert.equal(codexLeaning.model, "haiku");
  assert.match(codexLeaning.reason, /approval/i);
});

test("Claude is blocked when authority mode pauses or halts Claude", () => {
  const paused = decideClaudeModel("claude-paused");
  assert.equal(paused.allowed, false);
  assert.equal(paused.model, undefined);
  assert.match(paused.reason, /paused|disabled/i);

  const halted = decideClaudeModel("halt");
  assert.equal(halted.allowed, false);
  assert.equal(halted.model, undefined);
  assert.match(halted.reason, /halt|disabled/i);
});

test("Codex reasoning effort follows remaining percent when supported", () => {
  const high = decideCodexEffort({ remainingPercent: 41, supportsReasoningEffort: true });
  assert.equal(high.effort, "high");
  assert.match(high.reason, />\s*40|high/i);

  const mediumAtUpperBound = decideCodexEffort({ remainingPercent: 40, supportsReasoningEffort: true });
  assert.equal(mediumAtUpperBound.effort, "medium");
  assert.match(mediumAtUpperBound.reason, /20|40|medium/i);

  const mediumAtLowerBound = decideCodexEffort({ remainingPercent: 20, supportsReasoningEffort: true });
  assert.equal(mediumAtLowerBound.effort, "medium");
  assert.match(mediumAtLowerBound.reason, /20|40|medium/i);

  const low = decideCodexEffort({ remainingPercent: 19, supportsReasoningEffort: true });
  assert.equal(low.effort, "low");
  assert.match(low.reason, /<\s*20|low/i);
});

test("Codex reasoning effort is unavailable when the CLI does not support it", () => {
  const unavailable = decideCodexEffort({ remainingPercent: 88, supportsReasoningEffort: false });
  assert.equal(unavailable.effort, "unavailable");
  assert.match(unavailable.reason, /unavailable|support/i);
});
