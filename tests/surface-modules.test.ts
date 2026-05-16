import test from "node:test";
import assert from "node:assert/strict";
import { parseCcusage } from "../src/ccusage.js";
import { parseFrontmatter, parseFrontmatterPaths } from "../src/frontmatter.js";
import { windowsToPosixPath, posixToWindowsPath } from "../src/path-utils.js";
import { summarizePlanStatus } from "../src/status.js";
import { findMissingSlashCommands, parseSlashCommandsFromClaudeJson } from "../src/claude-runtime.js";

test("ccusage module exposes usage parser", () => {
  const usage = parseCcusage({ models: { codex: { used: 40, limit: 100 } } });

  assert.equal(usage.codexPercent, 40);
});

test("frontmatter module extracts paths array", () => {
  const paths = parseFrontmatterPaths("---\npaths:\n  - src/**/*.ts\n---\n# Rule\n");

  assert.deepEqual(paths, ["src/**/*.ts"]);
});

test("frontmatter module parses scalar command metadata", () => {
  const parsed = parseFrontmatter("---\ndescription: Show status\nargument-hint: \"[scope]\"\n---\n# /status\n");

  assert.equal(parsed.description, "Show status");
  assert.equal(parsed["argument-hint"], "[scope]");
});

test("path utils convert Windows and POSIX drive paths", () => {
  assert.equal(windowsToPosixPath("C:\\Users\\SAMSUNG\\project"), "/c/Users/SAMSUNG/project");
  assert.equal(posixToWindowsPath("/c/Users/SAMSUNG/project"), "C:\\Users\\SAMSUNG\\project");
});

test("status module summarizes remaining and current ratchet task", () => {
  const status = summarizePlanStatus("- [x] Done\n- [ ] ← current Current\n- [ ] Later");

  assert.deepEqual(status, { remaining: 2, current: "Current" });
});

test("claude runtime parser extracts slash commands from JSON result text", () => {
  const commands = parseSlashCommandsFromClaudeJson(JSON.stringify({
    result: "/goal\n/next\n/status\n"
  }));

  assert.deepEqual(commands, ["/goal", "/next", "/status"]);
});

test("claude runtime checker reports missing expected commands", () => {
  const missing = findMissingSlashCommands(["/goal", "/next"], ["/goal", "/status"]);

  assert.deepEqual(missing, ["/next"]);
});
