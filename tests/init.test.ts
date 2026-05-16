import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../src/init.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test("initProject creates Claude files, memory dirs, import line, and gitignore entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-init-"));
  await writeFile(join(root, "CLAUDE.md"), "# User Rules\n\nDo not overwrite me.\n", "utf8");
  await writeFile(join(root, ".gitignore"), "node_modules/\n", "utf8");

  const result = await initProject(root);

  assert.equal(result.created.length > 0, true);
  assert.equal(await exists(join(root, ".claude", "commands", "goal.md")), true);
  assert.equal(await exists(join(root, ".claude", "rules", "ratchet.md")), true);
  assert.equal(await exists(join(root, ".claude", "hooks", "post-tool-use.sh")), true);
  assert.equal(await exists(join(root, ".claude", "settings.json")), true);
  assert.equal(await exists(join(root, ".claude", "statusline.sh")), true);
  assert.equal(await exists(join(root, ".claude", "myorch.md")), true);
  assert.equal(await exists(join(root, ".myorch", "memory")), true);
  assert.equal(await exists(join(root, ".myorch", "backups")), true);
  assert.equal(await exists(join(root, ".myorch", "handover")), true);

  const claude = await readFile(join(root, "CLAUDE.md"), "utf8");
  assert.match(claude, /Do not overwrite me/);
  assert.equal((claude.match(/@\.claude\/myorch\.md/g) ?? []).length, 1);

  const gitignore = await readFile(join(root, ".gitignore"), "utf8");
  assert.match(gitignore, /node_modules\//);
  assert.match(gitignore, /\.myorch\/memory\//);
  assert.match(gitignore, /\.claude\/debug\//);
});

test("initProject is idempotent, refreshes myorch.md, and force only overwrites other owned files", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-init-"));
  await initProject(root);
  await writeFile(join(root, ".claude", "myorch.md"), "custom local edit\n", "utf8");
  await writeFile(join(root, ".claude", "commands", "goal.md"), "custom command\n", "utf8");

  await initProject(root);
  assert.match(await readFile(join(root, ".claude", "myorch.md"), "utf8"), /myorch/);
  assert.equal(await readFile(join(root, ".claude", "commands", "goal.md"), "utf8"), "custom command\n");
  const claude = await readFile(join(root, "CLAUDE.md"), "utf8");
  assert.equal((claude.match(/@\.claude\/myorch\.md/g) ?? []).length, 1);

  await initProject(root, { force: true });
  assert.match(await readFile(join(root, ".claude", "myorch.md"), "utf8"), /myorch/);
  assert.match(await readFile(join(root, ".claude", "commands", "goal.md"), "utf8"), /myorch/);
});
