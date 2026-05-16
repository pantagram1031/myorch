import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  executeRoutedTask,
  packageCurrentTask,
  runAutomatedMetareview,
  validateMetareviewText
} from "../src/orchestration.js";

test("packageCurrentTask includes title, verifier, and file hints", () => {
  const prompt = packageCurrentTask([
    "- [ ] ← current **Task 7: Add feature**",
    "  - Files: `src/a.ts`, `tests/a.test.ts`",
    "  - Verifier: `npm test`"
  ].join("\n"));

  assert.match(prompt, /Task 7: Add feature/);
  assert.match(prompt, /src\/a\.ts/);
  assert.match(prompt, /npm test/);
});

test("executeRoutedTask calls Codex when router selects codex and advances verifier PASS", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-route-codex-"));
  const codex = join(root, "fake-codex.cmd");
  await writeFile(codex, "@echo off\r\necho codex-called %*\r\nexit /b 0\r\n", "utf8");
  await writeFile(join(root, "plan.md"), "- [ ] ← current Implement thing\n  - Files: `src/thing.ts`\n  - Verifier: `node -e \"process.exit(0)\"`\n", "utf8");

  const result = await executeRoutedTask(root, {
    taskKind: "implementation",
    codexCommand: codex,
    usageRaw: { models: { claude: { used: 1, limit: 100 }, codex: { used: 1, limit: 100 } } },
    maxRetries: 1,
    metareview: false
  });

  const handoff = await readFile(join(root, ".myorch", "memory", "handoff.jsonl"), "utf8");
  const plan = await readFile(join(root, "plan.md"), "utf8");
  assert.equal(result.model, "codex");
  assert.equal(result.verified, true);
  assert.match(handoff, /codex-called/);
  assert.match(plan, /\[x\]/);
});

test("executeRoutedTask falls back to claude after Codex retry limit", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-route-fallback-"));
  const codex = join(root, "bad-codex.cmd");
  await writeFile(codex, "@echo off\r\necho codex-fail\r\nexit /b 2\r\n", "utf8");
  await writeFile(join(root, "plan.md"), "- [ ] ← current Implement thing\n  - Verifier: `node -e \"process.exit(0)\"`\n", "utf8");

  const result = await executeRoutedTask(root, {
    taskKind: "implementation",
    codexCommand: codex,
    usageRaw: { models: { codex: { used: 1, limit: 100 } } },
    maxRetries: 2,
    metareview: false
  });

  assert.equal(result.model, "claude");
  assert.equal(result.fallback, true);
  assert.equal(result.attempts, 2);
});

test("metareview rejects looks-good-only text", () => {
  assert.equal(validateMetareviewText("looks good").ok, false);
  assert.equal(validateMetareviewText("Verifier evidence: npm test PASS exit=0. Assessment: acceptable.").ok, true);
});

test("runAutomatedMetareview records claude and codex review evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-meta-"));
  const claude = join(root, "fake-claude.cmd");
  const codex = join(root, "fake-codex.cmd");
  await writeFile(claude, "@echo off\r\necho {\"result\":\"Verifier evidence: npm test PASS exit=0. Claude review ok.\"}\r\nexit /b 0\r\n", "utf8");
  await writeFile(codex, "@echo off\r\necho Verifier evidence: npm test PASS exit=0. Codex meta-judgment ok.\r\nexit /b 0\r\n", "utf8");

  const result = await runAutomatedMetareview(root, {
    completedBy: "codex",
    verifierEvidence: "npm test PASS exit=0",
    claudeCommand: claude,
    codexCommand: codex
  });

  const memory = await readFile(join(root, ".myorch", "memory", "metareview.jsonl"), "utf8");
  assert.equal(result.ok, true);
  assert.match(memory, /Claude review ok/);
  assert.match(memory, /Codex meta-judgment ok/);
});
