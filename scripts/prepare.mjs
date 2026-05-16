import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const requiredBuildDeps = [
  join("node_modules", "typescript", "bin", "tsc"),
  join("node_modules", "@types", "node", "package.json")
];

if (!requiredBuildDeps.every((path) => existsSync(path))) {
  run("npx", [
    "--yes",
    "--package",
    "typescript@5.8.3",
    "--package",
    "@types/node@22.15.18",
    "node",
    "scripts/build-with-npx.mjs"
  ]);
} else {
  run("npm", ["run", "build"]);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
