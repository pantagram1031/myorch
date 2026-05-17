import test from "node:test";
import assert from "node:assert/strict";
import {
  pickLatestUsageInsightFilename,
  renderUsageInsight,
  usageInsightFilenameForDate
} from "../src/usage-insight.js";

test("usage insight renders model efficiency, reasoning effect, transitions, metareview ROI, and OSS adoption", () => {
  const markdown = renderUsageInsight({
    generatedAt: "2026-05-17",
    modelStats: [
      { model: "codex", tokens: 1000, passCount: 4, taskCount: 5 },
      { model: "claude", tokens: 700, passCount: 2, taskCount: 2 }
    ],
    reasoningStats: [
      { level: "high", passCount: 3, taskCount: 4 },
      { level: "medium", passCount: 0, taskCount: 0 }
    ],
    transitions: [
      { from: "efficient", to: "claude-paused", count: 2 },
      { from: "sandboxed", to: "oss-review", count: 1 }
    ],
    metareview: { caughtDefects: 1, reviewedTasks: 4 },
    oss: { accepted: 1, rejected: 3, pending: 1 }
  });

  assert.match(markdown, /^# Usage Insight$/m);
  assert.match(markdown, /^_Generated: 2026-05-17_$/m);
  assert.match(markdown, /^## Model Token Efficiency$/m);
  assert.match(markdown, /codex: 1000 tokens, 0\.80 PASS ratio/);
  assert.match(markdown, /claude: 700 tokens, 1\.00 PASS ratio/);
  assert.match(markdown, /^## Reasoning Level Effect$/m);
  assert.match(markdown, /high: 0\.75 PASS ratio/);
  assert.match(markdown, /medium: 0\.00 PASS ratio/);
  assert.match(markdown, /^## Permission Transition Patterns$/m);
  assert.match(markdown, /efficient -> claude-paused: 2/);
  assert.match(markdown, /sandboxed -> oss-review: 1/);
  assert.match(markdown, /^## Metareview ROI$/m);
  assert.match(markdown, /1 defects caught across 4 reviewed tasks \(0\.25 per task\)/);
  assert.match(markdown, /^## OSS Adoption$/m);
  assert.match(markdown, /accepted=1, rejected=3, pending=1, adoption=0\.20/);
});

test("usage insight helpers format and pick the latest daily insight filename", () => {
  assert.equal(usageInsightFilenameForDate("2026-05-17"), "usage-insight-2026-05-17.md");
  assert.equal(
    pickLatestUsageInsightFilename([
      "notes.md",
      "usage-insight-2026-05-12.md",
      "usage-insight-2026-05-17.md",
      "usage-insight-2026-05-15.md"
    ]),
    "usage-insight-2026-05-17.md"
  );
  assert.equal(pickLatestUsageInsightFilename(["notes.md"]), undefined);
});
