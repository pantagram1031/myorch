import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const tscName = process.platform === "win32" ? "tsc.cmd" : "tsc";
const npxBin = (process.env.PATH ?? "")
  .split(delimiter)
  .find((entry) => entry.includes("_npx") && existsSync(join(entry, tscName)))
  ?? findNpxBinFromCache();

if (!npxBin) {
  console.error("myorch prepare: cannot locate npx build dependencies on PATH.");
  process.exit(1);
}

const nodeModules = basename(npxBin) === ".bin" ? dirname(npxBin) : join(npxBin, "node_modules");
const tsc = join(npxBin, tscName);
const typeRoots = join(nodeModules, "@types");

const result = spawnSync(tsc, ["-p", "tsconfig.json", "--typeRoots", typeRoots], {
  stdio: "inherit",
  shell: process.platform === "win32",
  windowsHide: true
});

process.exit(result.status ?? 1);

function findNpxBinFromCache() {
  const cache = process.env.npm_config_cache;
  if (!cache) return undefined;
  return findFileDir(join(cache, "_npx"), tscName);
}

function findFileDir(root, fileName) {
  try {
    for (const entry of readdirSync(root)) {
      const path = join(root, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        const found = findFileDir(path, fileName);
        if (found) return found;
      } else if (entry === fileName) {
        return dirname(path);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
