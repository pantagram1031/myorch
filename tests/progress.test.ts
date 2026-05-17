import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendProgress, nextPushFailureCount } from "../src/progress.js";

test("appendProgress writes human and machine progress records", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-progress-"));

  await appendProgress(root, {
    cycle: 2,
    task: 3,
    summary: "token guard pass",
    evidence: "node --test PASS"
  });

  const human = await readFile(join(root, "PROGRESS.md"), "utf8");
  const machine = await readFile(join(root, ".myorch", "memory", "progress.jsonl"), "utf8");

  assert.match(human, /# PROGRESS/);
  assert.match(human, /cycle 2 task 3: token guard pass/);
  assert.match(human, /Evidence: node --test PASS/);
  assert.match(machine, /"cycle":2/);
  assert.match(machine, /"task":3/);
  assert.match(machine, /"summary":"token guard pass"/);
});

test("appendProgress appends instead of overwriting prior records", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-progress-"));

  await appendProgress(root, {
    cycle: 1,
    task: 1,
    summary: "first pass",
    evidence: "alpha"
  });
  await appendProgress(root, {
    cycle: 1,
    task: 2,
    summary: "second pass",
    evidence: "beta"
  });

  const human = await readFile(join(root, "PROGRESS.md"), "utf8");
  const machine = await readFile(join(root, ".myorch", "memory", "progress.jsonl"), "utf8");

  assert.equal((human.match(/cycle 1 task/g) ?? []).length, 2);
  assert.equal(machine.trim().split("\n").length, 2);
  assert.match(machine, /"summary":"first pass"/);
  assert.match(machine, /"summary":"second pass"/);
});

test("nextPushFailureCount increments failures and resets after success", () => {
  assert.equal(nextPushFailureCount(0, false), 1);
  assert.equal(nextPushFailureCount(4, false), 5);
  assert.equal(nextPushFailureCount(4, true), 0);
});
