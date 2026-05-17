import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildClaudeSettings,
  detectManualPlanCheckboxEdit,
  parseHookDecision,
  verifyAndAdvancePlan
} from "../src/enforcement.js";
import { readCcusage } from "../src/ccusage.js";

test("settings registers PostToolUse verifier and PreToolUse plan guard hooks", () => {
  const settings = buildClaudeSettings();

  assert.equal(settings.hooks.PostToolUse[0].matcher, "Edit|Write|Bash");
  assert.match(settings.hooks.PostToolUse[0].hooks[0].command, /post-tool-use\.sh/);
  assert.equal(settings.hooks.PreToolUse[0].matcher, "Edit|Write");
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /pre-tool-use-plan-guard\.js/);
  assert.equal(settings.hooks.UserPromptExpansion[0].matcher, "goal");
  assert.match(settings.hooks.UserPromptExpansion[0].hooks[0].command, /goal-start-hook/);
  assert.match(settings.hooks.PreCompact[0].hooks[0].command, /compact-backup/);
  assert.match(settings.hooks.PostCompact[0].hooks[0].command, /compact-record/);
  assert.equal(settings.hooks.SessionStart[0].matcher, "compact");
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /compact-restore/);
  assert.match(settings.statusLine.command, /statusline\.sh/);
});

test("plan guard blocks direct checkbox edits to plan.md", () => {
  const decision = detectManualPlanCheckboxEdit({
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    tool_input: {
      file_path: "C:\\project\\plan.md",
      old_string: "- [ ] Task",
      new_string: "- [x] Task"
    }
  });

  assert.equal(decision.block, true);
  assert.match(decision.reason ?? "", /ratchet advance/i);
});

test("hook decision parser emits block JSON for blocked edit", () => {
  const json = parseHookDecision({ block: true, reason: "blocked" });

  assert.deepEqual(JSON.parse(json), { decision: "block", reason: "blocked" });
});

test("verifyAndAdvancePlan records evidence and advances on PASS", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-enforce-"));
  const planPath = join(root, "plan.md");
  await writeFile(planPath, "- [ ] ← current Task\n  - Verifier: `node -e \"process.exit(0)\"`\n", "utf8");

  const result = await verifyAndAdvancePlan(root);
  const plan = await readFile(planPath, "utf8");
  const memory = await readFile(join(root, ".myorch", "memory", "verifier.jsonl"), "utf8");

  assert.equal(result.ok, true);
  assert.match(plan, /- \[x\] Task/);
  assert.match(memory, /"ok":true/);
});

test("ccusage reader supports CCUSAGE_MOCK_JSON for scenario fallback tests", async () => {
  const usage = await readCcusage({
    env: { CCUSAGE_MOCK_JSON: JSON.stringify({ models: { claude: { used: 90, limit: 100 } } }) }
  });

  assert.equal((usage as { models: { claude: { used: number } } }).models.claude.used, 90);
});

test("scenario runner file exists as executable automation entrypoint", async () => {
  await mkdir(".myorch", { recursive: true });
  const script = await readFile("scripts/run-scenarios.mjs", "utf8");

  assert.match(script, /verify:claude-runtime/);
  assert.match(script, /CCUSAGE_MOCK_JSON/);
});

test("scenario runner does not statically import v2 modules from root dist", async () => {
  const script = await readFile("scripts/run-scenarios.mjs", "utf8");

  assert.doesNotMatch(script, /from "\.\.\/dist\/src\/(?:autonomous-loop|oss-explorer|reasoning-decider|token-guard)\.js"/);
  assert.match(script, /importWorkModule/);
});
