import { spawn } from "node:child_process";

const prompt = process.argv.slice(2).join(" ") || "Return JSON confirming Claude Code is available for myorch dogfood.";
const child = spawn("claude", ["-p", prompt, "--output-format", "json"], {
  shell: true,
  windowsHide: true
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
child.on("close", (code) => {
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  process.exitCode = code ?? 1;
});
