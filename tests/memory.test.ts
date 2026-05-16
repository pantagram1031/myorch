import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendMemoryRecord } from "../src/memory.js";

test("memory appends JSONL records under memory directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-memory-"));
  const file = await appendMemoryRecord(root, "routing", { model: "codex" });
  const content = await readFile(file, "utf8");

  assert.match(content, /"kind":"routing"/);
  assert.match(content, /"model":"codex"/);
});
