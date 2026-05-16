#!/usr/bin/env node
import { spawnSync } from "node:child_process";
let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
});
process.stdin.on("end", () => {
  const result = spawnSync("myorch", ["guard-plan-edit"], {
    input: stdin,
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
});
