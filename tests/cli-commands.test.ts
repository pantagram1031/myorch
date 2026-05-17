import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cliPath = join(repoRoot, "src", "cli.ts");
const tsxLoaderPath = pathToFileURL(join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs")).href;

type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

async function runCli(root: string, args: string[]): Promise<CliResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ["--import", tsxLoaderPath, cliPath, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolveResult({ stdout, stderr, exitCode: exitCode ?? -1 });
    });
  });
}

async function makeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, ".myorch", "memory"), { recursive: true });
  return root;
}

test("usage string includes resume, confirm-reset, reject-reset, and oss-review", async () => {
  const root = await makeRoot("myorch-cli-usage-");

  const result = await runCli(root, ["unknown-command"]);

  assert.equal(result.exitCode, 1);
  assert.match(result.stdout, /resume/);
  assert.match(result.stdout, /confirm-reset/);
  assert.match(result.stdout, /reject-reset/);
  assert.match(result.stdout, /oss-review/);
});

test("resume prints sleep-state json when present", async () => {
  const root = await makeRoot("myorch-cli-resume-state-");
  await writeFile(
    join(root, ".myorch", "sleep-state.json"),
    JSON.stringify({ status: "sleeping", task: "Task 9", until: "2026-05-17T10:00:00.000Z" }),
    "utf8"
  );

  const result = await runCli(root, ["resume"]);

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "sleeping",
    task: "Task 9",
    until: "2026-05-17T10:00:00.000Z"
  });
});

test("resume reports no-sleep-state when no sleep-state file exists", async () => {
  const root = await makeRoot("myorch-cli-resume-empty-");

  const result = await runCli(root, ["resume"]);

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), { status: "no-sleep-state" });
});

test("confirm-reset appends manual reset decision record", async () => {
  const root = await makeRoot("myorch-cli-confirm-reset-");

  const result = await runCli(root, ["confirm-reset"]);

  assert.equal(result.exitCode, 0);
  const content = await readFile(join(root, ".myorch", "memory", "decisions.jsonl"), "utf8");
  const lines = content.trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    reason: "manual-reset-decision",
    decision: "confirm-reset"
  });
});

test("reject-reset appends manual reset decision record", async () => {
  const root = await makeRoot("myorch-cli-reject-reset-");

  const result = await runCli(root, ["reject-reset"]);

  assert.equal(result.exitCode, 0);
  const content = await readFile(join(root, ".myorch", "memory", "decisions.jsonl"), "utf8");
  const lines = content.trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    reason: "manual-reset-decision",
    decision: "reject-reset"
  });
});

test("oss-review prints pending merge log when present", async () => {
  const root = await makeRoot("myorch-cli-oss-review-present-");
  await writeFile(
    join(root, ".myorch", "memory", "oss-pending-merge.jsonl"),
    "{\"id\":1,\"title\":\"merge me\"}\n{\"id\":2,\"title\":\"still pending\"}\n",
    "utf8"
  );

  const result = await runCli(root, ["oss-review"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "{\"id\":1,\"title\":\"merge me\"}\n{\"id\":2,\"title\":\"still pending\"}\n");
});

test("oss-review prints empty output when no pending merge log exists", async () => {
  const root = await makeRoot("myorch-cli-oss-review-empty-");

  const result = await runCli(root, ["oss-review"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});
