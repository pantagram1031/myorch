import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
// Runtime slash recognition is verified separately by verify:claude-runtime.
// Scenario 1 uses deterministic CLI enforcement so scenario runs stay bounded.
const scenarioRoot = await mkdtemp(join(tmpdir(), "myorch-scenarios-"));
const work = join(scenarioRoot, "project");
await cp(root, work, {
  recursive: true,
  filter: (src) => {
    const normalized = src.replaceAll("\\", "/");
    const rootNorm = root.replaceAll("\\", "/");
    return !normalized.includes(`${rootNorm}/node_modules`)
      && !normalized.includes(`${rootNorm}/.git`)
      && !normalized.includes(`${rootNorm}/.myorch`);
  }
});

const results = [];

try {
  await run("npm", ["install"], {});
  await run("npm", ["run", "build"], {});

  await scenario("scenario1-goal", async () => {
    const output = await runNode(["dist/src/cli.js", "goal-start", "add a trivial function"], {});
    await runNode(["dist/src/cli.js", "verify-and-advance"], {});
    await ensureMemory("routing");
    await ensureMemory("verifier");
    const plan = await readFile(join(work, "plan.md"), "utf8");
    if (!plan.includes("[x]")) throw new Error("expected ratchet checkbox to be marked by system");
    return { output, plan };
  });

  await scenario("scenario2-usage-fallback", async () => {
    const output = await runNode(["dist/src/cli.js", "route", "planning"], {
      CCUSAGE_MOCK_JSON: JSON.stringify({ models: { claude: { used: 90, limit: 100 }, codex: { used: 1, limit: 100 } } })
    });
    if (!output.includes('"model": "codex"')) throw new Error(`expected codex fallback, got ${output}`);
    return { output };
  });

  await scenario("scenario3-verifier-fail", async () => {
    const failingPlan = "- [ ] ← current Failing scenario\n  - Verifier: `node -e \"process.exit(1)\"`\n";
    await writeFile(join(work, "plan.md"), failingPlan, "utf8");
    const output = await runNode(["dist/src/cli.js", "verify-and-advance"], {}, { allowFailure: true });
    const plan = await readFile(join(work, "plan.md"), "utf8");
    if (!output.includes("FAIL")) throw new Error("expected verifier FAIL evidence");
    if (!plan.includes("[ ] ← current")) throw new Error("failing verifier must not advance ratchet");
    return { output, plan };
  });

  await scenario("scenario4-compact-intent", async () => {
    const passingPlan = "- [ ] ← current Passing scenario\n  - Verifier: `node -e \"process.exit(0)\"`\n";
    await writeFile(join(work, "plan.md"), passingPlan, "utf8");
    await runNode(["dist/src/cli.js", "verify-and-advance"], {});
    const compact = await readFile(join(work, ".myorch", "memory", "compact.jsonl"), "utf8");
    if (!compact.includes("ratchet-pass")) throw new Error("expected compact intent log after PASS");
    return { compact };
  });

  await scenario("scenario5-codex-routed-e2e", async () => {
    const fakeCodex = join(work, "fake-codex.cmd");
    await writeFile(fakeCodex, "@echo off\r\necho Verifier evidence: npm test PASS exit=0. fake codex executed %*\r\nexit /b 0\r\n", "utf8");
    await writeFile(join(work, "plan.md"), "- [ ] ← current Routed Codex scenario\n  - Files: `src/routed.ts`\n  - Verifier: `node -e \"process.exit(0)\"`\n", "utf8");
    const output = await runNode(["dist/src/cli.js", "execute-routed", "implementation", "--codex-command", fakeCodex, "--no-metareview"], {
      CCUSAGE_MOCK_JSON: JSON.stringify({ models: { claude: { used: 1, limit: 100 }, codex: { used: 1, limit: 100 } } })
    });
    const handoff = await readFile(join(work, ".myorch", "memory", "handoff.jsonl"), "utf8");
    const plan = await readFile(join(work, "plan.md"), "utf8");
    if (!output.includes('"model": "codex"')) throw new Error(`expected codex execution result, got ${output}`);
    if (!handoff.includes("fake codex executed")) throw new Error("expected handoff memory to include codex execution");
    if (!plan.includes("[x]")) throw new Error("expected ratchet advancement after codex execution");
    return { output, handoff: summarizeOutput(handoff), plan };
  });

  await scenario("scenario6-metareview-e2e", async () => {
    const fakeClaude = join(work, "fake-claude.cmd");
    const fakeCodex = join(work, "fake-codex-review.cmd");
    await writeFile(fakeClaude, "@echo off\r\necho {\"result\":\"Verifier evidence: npm test PASS exit=0. Claude review ok.\"}\r\nexit /b 0\r\n", "utf8");
    await writeFile(fakeCodex, "@echo off\r\necho Verifier evidence: npm test PASS exit=0. Codex meta judgment ok.\r\nexit /b 0\r\n", "utf8");
    const output = await runNode([
      "dist/src/cli.js",
      "metareview-auto",
      "--completed-by",
      "codex",
      "--evidence",
      "npm test PASS exit=0",
      "--claude-command",
      fakeClaude,
      "--codex-command",
      fakeCodex
    ], {});
    const memory = await readFile(join(work, ".myorch", "memory", "metareview.jsonl"), "utf8");
    if (!memory.includes("Claude review ok")) throw new Error("expected Claude review in metareview memory");
    if (!memory.includes("Codex meta judgment ok")) throw new Error("expected Codex judgment in metareview memory");
    return { output, memory: summarizeOutput(memory) };
  });

  await scenario("scenario8-compact-survival-e2e", async () => {
    await writeFile(join(work, "plan.md"), "- [ ] ??current Compact survival\n  - Verifier: `node -e \"process.exit(0)\"`\n", "utf8");
    await mkdir(join(work, ".myorch", "memory"), { recursive: true });
    await writeFile(join(work, ".myorch", "memory", "routing.jsonl"), "{\"model\":\"codex\"}\n", "utf8");
    await writeFile(join(work, ".myorch", "memory", "verifier.jsonl"), "{\"ok\":true,\"evidence\":\"npm test PASS exit=0\"}\n", "utf8");
    const backup = await runNode(["dist/src/cli.js", "compact-backup", "--trigger", "manual"], {}, {
      input: JSON.stringify({ custom_instructions: "focus compact survival" })
    });
    const record = await runNode(["dist/src/cli.js", "compact-record"], {}, {
      input: JSON.stringify({ compact_summary: "compact kept ratchet context" })
    });
    const restored = await runNode(["dist/src/cli.js", "compact-restore"], {});
    if (!backup.includes("precompact-")) throw new Error(`expected precompact backup, got ${backup}`);
    if (!restored.includes("Compact restart session")) throw new Error(`expected compact session reminder, got ${restored}`);
    if (!restored.includes("Compact survival")) throw new Error("expected restored handover to include current task");
    return { backup, record, restored: summarizeOutput(restored) };
  });

  await scenario("scenario9-statusline-format", async () => {
    const output = await runNode(["dist/src/cli.js", "statusline"], {
      CCUSAGE_MOCK_JSON: JSON.stringify({ blockRemainingMinutes: 33, burnRateTokensPerMinute: 456 })
    }, {
      input: JSON.stringify({
        model: { display_name: "Opus" },
        cost: { total_cost_usd: 2.5 },
        context_window: { used_percentage: 86 }
      })
    });
    if (!output.includes("Opus")) throw new Error(`missing model: ${output}`);
    if (!output.includes("$2.50")) throw new Error(`missing cost: ${output}`);
    if (!output.includes("5h:33m")) throw new Error(`missing block remaining: ${output}`);
    if (!output.includes("456 tok/min")) throw new Error(`missing burn rate: ${output}`);
    if (!output.includes("ctx:86%")) throw new Error(`missing context percent: ${output}`);
    if (!output.includes("WARNING")) throw new Error(`missing threshold warning: ${output}`);
    if (!output.includes("Current:")) throw new Error(`missing ratchet progress: ${output}`);
    return { output };
  });

  await scenario("scenario10-notification-dedup", async () => {
    await run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(work, "scripts", "notify.ps1"),
      "-Title",
      "Dedup",
      "-Message",
      "first",
      "-Severity",
      "warn",
      "-Dedup",
      "scenario10",
      "-Root",
      work
    ], { MYORCH_NOTIFY_TRANSPORT: "log" });
    await run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(work, "scripts", "notify.ps1"),
      "-Title",
      "Dedup",
      "-Message",
      "second",
      "-Severity",
      "warn",
      "-Dedup",
      "scenario10",
      "-Root",
      work
    ], { MYORCH_NOTIFY_TRANSPORT: "log" });
    const log = await readFile(join(work, ".myorch", "memory", "notifications.jsonl"), "utf8");
    const matches = log.split(/\r?\n/).filter((line) => line.includes("scenario10"));
    if (matches.length !== 1) throw new Error(`expected one delivered notification, got ${matches.length}: ${log}`);
    return { log: matches.join("\n") };
  });

  await scenario("scenario11-global-init-e2e", async () => {
    const prefix = join(scenarioRoot, "global-prefix");
    const target = join(scenarioRoot, "fresh-target");
    const npmCache = join(scenarioRoot, "npm-cache");
    const installSource = process.env.MYORCH_SCENARIO11_INSTALL_SOURCE ?? ".";
    await mkdir(prefix, { recursive: true });
    await mkdir(target, { recursive: true });
    await mkdir(npmCache, { recursive: true });

    await runAt("npm", ["install", "-g", installSource, "--prefix", prefix], work, { npm_config_cache: npmCache }, { timeoutMs: 180000 });
    const myorchBin = process.platform === "win32" ? join(prefix, "myorch.cmd") : join(prefix, "bin", "myorch");
    const pathEnv = { PATH: `${process.platform === "win32" ? prefix : join(prefix, "bin")}${delimiter}${process.env.PATH ?? ""}` };

    const firstInit = await runQuotedAt(myorchBin, ["init"], target, pathEnv, { timeoutMs: 60000 });
    const claudeMd = await readFile(join(target, "CLAUDE.md"), "utf8");
    const gitignore = await readFile(join(target, ".gitignore"), "utf8");
    const goal = await readFile(join(target, ".claude", "commands", "goal.md"), "utf8");
    const myorchRules = await readFile(join(target, ".claude", "myorch.md"), "utf8");
    if (!claudeMd.includes("@.claude/myorch.md")) throw new Error("expected CLAUDE.md import line");
    if (!gitignore.includes(".myorch/memory/")) throw new Error("expected myorch gitignore entries");
    if (!goal.includes("myorch route planning")) throw new Error("expected global myorch slash command body");
    if (!myorchRules.includes("myorch owns this file")) throw new Error("expected myorch-owned rules file");

    await writeFile(join(target, ".claude", "commands", "next.md"), "custom next command\n", "utf8");
    await writeFile(join(target, ".claude", "myorch.md"), "custom overwritten on init\n", "utf8");
    const secondInit = await runQuotedAt(myorchBin, ["init"], target, pathEnv, { timeoutMs: 60000 });
    const updatedClaudeMd = await readFile(join(target, "CLAUDE.md"), "utf8");
    const next = await readFile(join(target, ".claude", "commands", "next.md"), "utf8");
    const refreshedMyorchRules = await readFile(join(target, ".claude", "myorch.md"), "utf8");
    const importCount = updatedClaudeMd.split("@.claude/myorch.md").length - 1;
    if (importCount !== 1) throw new Error(`expected one CLAUDE.md import, got ${importCount}`);
    if (next !== "custom next command\n") throw new Error("expected second init to preserve existing command without --force");
    if (!refreshedMyorchRules.includes("myorch owns this file")) throw new Error("expected second init to refresh .claude/myorch.md");

    await writeFile(join(target, "plan.md"), "- [ ] ??current Fresh global init\n  - Verifier: `node -e \"process.exit(0)\"`\n", "utf8");
    const status = await runQuotedAt(myorchBin, ["status"], target, pathEnv, { timeoutMs: 60000 });
    if (!status.includes("Fresh global init")) throw new Error(`expected myorch status to read initialized project plan, got ${status}`);

    const claude = await runQuotedAt("claude", ["-p", "/status", "--output-format", "json"], target, pathEnv, { timeoutMs: 180000 });
    if (!claude.includes("Fresh global init") && !claude.includes("status")) {
      throw new Error(`expected claude /status to recognize initialized slash command, got ${claude}`);
    }

    return {
      firstInit: summarizeOutput(firstInit),
      secondInit: summarizeOutput(secondInit),
      installSource,
      status,
      claude: summarizeOutput(claude)
    };
  });

  await scenario("scenario7-real-codex-smoke", async () => {
    const output = await runQuoted("codex", ["exec", "--skip-git-repo-check", "--cd", work, "Return exactly: codex-smoke-ok"], {}, { timeoutMs: 180000 });
    if (!output.toLowerCase().includes("codex-smoke-ok")) throw new Error(`expected real codex smoke response, got ${output}`);
    return { output: summarizeOutput(output) };
  });
} finally {
  await mkdir(join(root, ".myorch", "scenarios"), { recursive: true });
  await writeFile(join(root, ".myorch", "scenarios", "last-run.json"), JSON.stringify({ scenarioRoot, results }, null, 2), "utf8");
  await rm(scenarioRoot, { recursive: true, force: true });
}

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify(results, null, 2));
if (failed.length > 0) process.exit(1);

async function scenario(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
  await mkdir(join(root, ".myorch", "scenarios"), { recursive: true });
  await writeFile(join(root, ".myorch", "scenarios", "last-run.json"), JSON.stringify({ scenarioRoot, results }, null, 2), "utf8");
}

function summarizeOutput(output) {
  if (output.length <= 1200) return output;
  return `${output.slice(0, 600)}\n...[truncated]...\n${output.slice(-600)}`;
}

async function runClaude(prompt, env) {
  return runQuoted("claude", ["-p", prompt, "--output-format", "json"], env);
}

async function runNode(args, env, options) {
  const child = spawn("node", args, {
    cwd: work,
    shell: false,
    windowsHide: true,
    env: { ...process.env, ...env }
  });
  return collect(child, "node", args, options ?? {});
}

async function run(command, args, env, options = {}) {
  const child = spawn(command, args, {
    cwd: work,
    shell: process.platform === "win32",
    windowsHide: true,
    env: { ...process.env, ...env }
  });
  return collect(child, command, args, options);
}

async function runAt(command, args, cwd, env, options = {}) {
  const child = spawn(command, args, {
    cwd,
    shell: process.platform === "win32",
    windowsHide: true,
    env: { ...process.env, ...env }
  });
  return collect(child, command, args, options);
}

async function runQuoted(command, args, env, options = {}) {
  const useShell = process.platform === "win32";
  const child = spawn(useShell ? quoteCommandLine(command, args) : command, useShell ? [] : args, {
    cwd: work,
    shell: useShell,
    windowsHide: true,
    env: { ...process.env, ...env }
  });
  return collect(child, command, args, options);
}

async function runQuotedAt(command, args, cwd, env, options = {}) {
  const useShell = process.platform === "win32";
  const child = spawn(useShell ? quoteCommandLine(command, args) : command, useShell ? [] : args, {
    cwd,
    shell: useShell,
    windowsHide: true,
    env: { ...process.env, ...env }
  });
  return collect(child, command, args, options);
}

async function collect(child, command, args, options) {
  let stdout = "";
  let stderr = "";
  if (options.input !== undefined) {
    child.stdin?.end(options.input);
  } else {
    child.stdin?.end();
  }
  let timedOut = false;
  const timeout = options.timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs)
    : undefined;
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (timeout) clearTimeout(timeout);
  const output = `${stdout}${stderr}`;
  if (timedOut) throw new Error(`${command} ${args.join(" ")} timed out: ${output}`);
  if (code !== 0 && !options.allowFailure) throw new Error(`${command} ${args.join(" ")} failed ${code}: ${output}`);
  return output;
}

function quoteCommandLine(command, args) {
  return [command, ...args].map((part) => `"${String(part).replaceAll('"', '\\"')}"`).join(" ");
}

async function ensureMemory(kind) {
  const file = join(work, ".myorch", "memory", `${kind}.jsonl`);
  const content = await readFile(file, "utf8");
  if (!content.trim()) throw new Error(`${kind} memory is empty`);
}
