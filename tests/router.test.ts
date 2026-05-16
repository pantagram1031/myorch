import test from "node:test";
import assert from "node:assert/strict";
import { parseCcusage, routeTask } from "../src/router.js";

test("router defaults planning and evaluation to claude", () => {
  assert.equal(routeTask({ taskKind: "planning" }).model, "claude");
  assert.equal(routeTask({ taskKind: "evaluation" }).model, "claude");
});

test("router defaults implementation and metareview to codex", () => {
  assert.equal(routeTask({ taskKind: "implementation" }).model, "codex");
  assert.equal(routeTask({ taskKind: "metareview" }).model, "codex");
});

test("router falls back away from model at or above 80 percent usage", () => {
  const usage = parseCcusage({
    models: {
      claude: { used: 81, limit: 100 },
      codex: { used: 10, limit: 100 }
    }
  });

  const decision = routeTask({ taskKind: "planning", usage });

  assert.equal(decision.model, "codex");
  assert.match(decision.reason, /claude usage/i);
});

test("router honors manual override when valid", () => {
  const decision = routeTask({
    taskKind: "implementation",
    manualOverride: "claude",
    usage: { claudePercent: 99, codexPercent: 1, warnings: [] }
  });

  assert.equal(decision.model, "claude");
  assert.match(decision.reason, /manual override/i);
});

test("router sends repeated verifier failures to claude for evaluation", () => {
  const decision = routeTask({ taskKind: "implementation", recentFailures: 2 });

  assert.equal(decision.model, "claude");
  assert.match(decision.reason, /recent verifier failures/i);
});

test("ccusage parser records warning for malformed data", () => {
  const usage = parseCcusage({ unexpected: true });

  assert.equal(usage.claudePercent, undefined);
  assert.equal(usage.codexPercent, undefined);
  assert.equal(usage.warnings.length, 1);
});

test("ccusage parser reads active real ccusage block shape", () => {
  const usage = parseCcusage({
    blocks: [
      {
        isActive: true,
        startTime: "2026-05-16T10:00:00.000Z",
        endTime: "2026-05-16T15:00:00.000Z",
        actualEndTime: "2026-05-16T14:00:00.000Z",
        models: ["claude-sonnet-4-6"],
        burnRate: { tokensPerMinute: 6596 },
        projection: { remainingMinutes: 60 }
      }
    ]
  });

  assert.equal(usage.claudePercent, 80);
  assert.deepEqual(usage.warnings, []);
});

test("ccusage parser accepts daily totals without malformed warning", () => {
  const usage = parseCcusage({ daily: [], totals: { totalCost: 20.27, totalTokens: 23089563 } });

  assert.equal(usage.claudePercent, undefined);
  assert.equal(usage.codexPercent, undefined);
  assert.match(usage.warnings.join("\n"), /do not include model limits/i);
});
