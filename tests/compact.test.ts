import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCompactBackup,
  recordCompactEvent,
  restoreLatestHandover
} from "../src/compact.js";

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "myorch-compact-"));
  await mkdir(join(root, ".myorch", "memory"), { recursive: true });
  await writeFile(join(root, "plan.md"), "- [ ] ??current Compact Task\n  - Verifier: `npm test`\n", "utf8");
  await writeFile(join(root, ".myorch", "memory", "routing.jsonl"), "{\"model\":\"codex\"}\n", "utf8");
  await writeFile(join(root, ".myorch", "memory", "verifier.jsonl"), "{\"ok\":true,\"evidence\":\"npm test PASS exit=0\"}\n", "utf8");
  return root;
}

test("createCompactBackup copies plan and memory and writes handover", async () => {
  const root = await makeRoot();

  const result = await createCompactBackup(root, {
    trigger: "manual",
    stdin: JSON.stringify({ custom_instructions: "focus on Compact Task" }),
    claudeCommand: ""
  });

  assert.equal(result.trigger, "manual");
  assert.match(result.backupDir, /precompact-/);
  assert.match(result.handoverPath, /handover-/);
  assert.match(await readFile(join(result.backupDir, "plan.md"), "utf8"), /Compact Task/);
  assert.match(await readFile(join(result.backupDir, "memory", "routing.jsonl"), "utf8"), /codex/);
  assert.match(await readFile(result.handoverPath, "utf8"), /Current task: Compact Task/);
  assert.match(await readFile(join(result.backupDir, "metadata.json"), "utf8"), /focus on Compact Task/);
});

test("recordCompactEvent writes compact memory with summary and notification intent", async () => {
  const root = await makeRoot();

  await recordCompactEvent(root, JSON.stringify({ compact_summary: "kept ratchet context" }));

  const compact = await readFile(join(root, ".myorch", "memory", "compact.jsonl"), "utf8");
  assert.match(compact, /kept ratchet context/);
  assert.match(compact, /postcompact/);
});

test("restoreLatestHandover emits newest handover plus current plan context", async () => {
  const root = await makeRoot();
  await mkdir(join(root, ".myorch", "handover"), { recursive: true });
  await writeFile(join(root, ".myorch", "handover", "handover-100.md"), "# Old\n", "utf8");
  await writeFile(join(root, ".myorch", "handover", "handover-200.md"), "# New\nCurrent task: Compact Task\n", "utf8");

  const restored = await restoreLatestHandover(root);

  assert.match(restored, /Compact restart session/);
  assert.match(restored, /handover-200\.md/);
  assert.match(restored, /Current task: Compact Task/);
});
