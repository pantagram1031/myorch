import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordNotificationAttempt, shouldNotify } from "../src/notify.js";

test("notification dedup suppresses repeated key inside ttl", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-notify-"));

  const first = await shouldNotify(root, "context-85", 300000, 1000);
  await recordNotificationAttempt(root, {
    key: "context-85",
    title: "Context",
    message: "Context at 85%",
    severity: "warn",
    nowMs: 1000,
    delivered: true
  });
  const second = await shouldNotify(root, "context-85", 300000, 2000);

  assert.equal(first, true);
  assert.equal(second, false);
  const log = await readFile(join(root, ".myorch", "memory", "notifications.jsonl"), "utf8");
  assert.match(log, /context-85/);
});
