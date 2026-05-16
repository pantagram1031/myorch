import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodexHandoff } from "../src/handoff.js";

test("handoff returns manual fallback when executable is missing", async () => {
  const result = await runCodexHandoff({
    codexCommand: "definitely-missing-codex-command",
    prompt: "implement task",
    timeoutMs: 1000
  });

  assert.equal(result.ok, false);
  assert.equal(result.fallbackRequired, true);
  assert.match(result.evidence, /missing|spawn|ENOENT/i);
});

test("handoff runs Windows command shims through the shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-codex-shim-"));
  const shim = join(root, "fake-codex.cmd");
  await writeFile(shim, "@echo off\r\necho fake-codex %*\r\nexit /b 0\r\n", "utf8");

  const result = await runCodexHandoff({
    codexCommand: shim,
    prompt: "hello",
    timeoutMs: 1000
  });

  assert.equal(result.ok, true);
  assert.match(result.stdout, /fake-codex exec --skip-git-repo-check --cd .* "hello"/);
});

test("handoff preserves multi-word prompts when using Windows command shims", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-codex-shim-"));
  const shim = join(root, "fake-codex.cmd");
  await writeFile(shim, "@echo off\r\necho argc=%*\r\nexit /b 0\r\n", "utf8");

  const result = await runCodexHandoff({
    codexCommand: shim,
    prompt: "hello multi word prompt",
    timeoutMs: 1000
  });

  assert.equal(result.ok, true);
  assert.match(result.stdout, /argc=exec --skip-git-repo-check --cd .* "hello multi word prompt"/);
});
