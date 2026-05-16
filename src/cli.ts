#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { advanceRatchet, parsePlan } from "./ratchet.js";
import { routeTask, parseCcusage } from "./router.js";
import { runCommand, validateClaudeCommandFrontmatter, validateRuleFrontmatter, validateUtf8NoBomLf, checkBashSyntax, checkPowerShellSyntax } from "./verifier.js";
import { appendMemoryRecord } from "./memory.js";
import { formatStatusLine, statusLineInputFromSession, summarizePlanStatus } from "./status.js";
import { runCodexHandoff } from "./handoff.js";
import { EXPECTED_SLASH_COMMANDS, verifyClaudeRuntime } from "./claude-runtime.js";
import { buildClaudeSettings, detectManualPlanCheckboxEdit, parseHookDecision, verifyAndAdvancePlan } from "./enforcement.js";
import { readCcusage as readCcusageData } from "./ccusage.js";
import { executeRoutedTask, runAutomatedMetareview } from "./orchestration.js";
import { createCompactBackup, recordCompactEvent, restoreLatestHandover } from "./compact.js";
import { recordNotificationAttempt, shouldNotify } from "./notify.js";
import { initProject } from "./init.js";
import type { TaskKind } from "./types.js";

const cwd = process.cwd();

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "init":
      await initCommand(args);
      break;
    case "route":
      await routeCommand(args);
      break;
    case "next":
      await nextCommand();
      break;
    case "status":
      await statusCommand();
      break;
    case "switch":
      await switchCommand(args);
      break;
    case "handoff":
      await handoffCommand(args);
      break;
    case "goal-start":
      await goalStartCommand(args);
      break;
    case "goal-start-hook":
      await goalStartHookCommand();
      break;
    case "verify-claude-files":
      await verifyClaudeFiles();
      break;
    case "verify-claude-runtime":
      await verifyClaudeRuntimeCommand();
      break;
    case "verify-and-advance":
      await verifyAndAdvanceCommand();
      break;
    case "execute-routed":
      await executeRoutedCommand(args);
      break;
    case "metareview-auto":
      await metareviewAutoCommand(args);
      break;
    case "compact-backup":
      await compactBackupCommand(args);
      break;
    case "compact-record":
      await compactRecordCommand();
      break;
    case "compact-restore":
      await compactRestoreCommand();
      break;
    case "statusline":
      await statuslineCommand();
      break;
    case "notify":
      await notifyCommand(args);
      break;
    case "guard-plan-edit":
      await guardPlanEditCommand();
      break;
    case "write-settings":
      await writeSettingsCommand();
      break;
    case "run-verifier":
      await runCurrentVerifier();
      break;
    default:
      console.log("usage: myorch <init|goal-start|route|handoff|execute-routed|metareview-auto|compact-backup|compact-record|compact-restore|statusline|notify|next|status|switch|verify-and-advance|guard-plan-edit|verify-claude-files|verify-claude-runtime|run-verifier>");
      process.exitCode = command ? 1 : 0;
  }
}

async function initCommand(args: string[]): Promise<void> {
  const result = await initProject(cwd, { force: args.includes("--force") });
  console.log(JSON.stringify(result, null, 2));
}

async function routeCommand(args: string[]): Promise<void> {
  const taskKind = (args[0] ?? "implementation") as TaskKind;
  const override = await readOverride();
  const usageRaw = await readCcusage();
  const recentFailures = await readRecentFailures();
  const decision = routeTask({ taskKind, manualOverride: override, usage: parseCcusage(usageRaw), recentFailures });
  await appendMemoryRecord(cwd, "routing", decision);
  console.log(JSON.stringify(decision, null, 2));
}

async function handoffCommand(args: string[]): Promise<void> {
  const prompt = args.join(" ").trim();
  if (!prompt) {
    console.error("handoff requires a prompt");
    process.exitCode = 1;
    return;
  }

  const result = await runCodexHandoff({ prompt, cwd });
  await appendMemoryRecord(cwd, "handoff", {
    ok: result.ok,
    fallbackRequired: result.fallbackRequired,
    exitCode: result.exitCode,
    evidence: result.evidence
  });
  console.log(result.evidence);
  process.exitCode = result.ok ? 0 : 1;
}

async function goalStartCommand(args: string[]): Promise<void> {
  const task = args.join(" ").trim() || "unspecified goal";
  await startGoal(task);
}

async function goalStartHookCommand(): Promise<void> {
  const stdin = await readStdin();
  let task = "";
  try {
    const event = JSON.parse(stdin) as { command_args?: string; prompt?: string };
    task = event.command_args?.trim() || event.prompt?.replace(/^\/goal\s*/, "").trim() || "";
  } catch {
    task = "";
  }
  await startGoal(task || "unspecified goal");
}

async function startGoal(task: string): Promise<void> {
  const usageRaw = await readCcusage();
  const planning = routeTask({ taskKind: "planning", usage: parseCcusage(usageRaw), recentFailures: await readRecentFailures() });
  const implementation = routeTask({ taskKind: "implementation", usage: parseCcusage(usageRaw), recentFailures: await readRecentFailures() });
  await appendMemoryRecord(cwd, "routing", { phase: "goal-start-planning", task, ...planning });
  await appendMemoryRecord(cwd, "routing", { phase: "goal-start-implementation", task, ...implementation });
  await writeFile(join(cwd, "spec.md"), `# Goal Spec\n\nTask: ${task}\n\nGenerated by myorch goal-start enforcement.\n`, "utf8");
  await writeFile(join(cwd, "plan.md"), [
    "# Enforced Goal Plan",
    "",
    `- [ ] ← current ${task}`,
    "  - Verifier: `npm test`",
    ""
  ].join("\n"), "utf8");
  console.log(JSON.stringify({ task, planning, implementation }, null, 2));
}

async function nextCommand(): Promise<void> {
  const planPath = join(cwd, "plan.md");
  const content = await readFile(planPath, "utf8");
  const parsed = parsePlan(content);
  const current = parsed.tasks.find((task) => task.current && !task.checked) ?? parsed.tasks.find((task) => !task.checked);
  if (!current?.verifier) {
    console.log("No current verifier found.");
    process.exitCode = 1;
    return;
  }
  const result = await runCommand(current.verifier, { cwd });
  await appendMemoryRecord(cwd, "verifier", { task: current.title, ok: result.ok, evidence: result.evidence });
  const ratchet = advanceRatchet(content, { passed: result.ok, evidence: result.evidence });
  if (ratchet.advanced) await writeFile(planPath, ratchet.content, "utf8");
  console.log(ratchet.evidence);
  process.exitCode = result.ok ? 0 : 1;
}

async function statusCommand(): Promise<void> {
  const content = await readFile(join(cwd, "plan.md"), "utf8");
  console.log(JSON.stringify(summarizePlanStatus(content), null, 2));
}

async function switchCommand(args: string[]): Promise<void> {
  const model = args[0];
  if (model !== "claude" && model !== "codex") {
    console.error("switch requires claude or codex");
    process.exitCode = 1;
    return;
  }
  await appendMemoryRecord(cwd, "override", { model });
  await writeFile(join(cwd, ".myorch", "manual-override"), model, "utf8");
  console.log(`manual override set to ${model}`);
}

async function runCurrentVerifier(): Promise<void> {
  await verifyAndAdvanceCommand();
}

async function verifyAndAdvanceCommand(): Promise<void> {
  const result = await verifyAndAdvancePlan(cwd);
  console.log(result.evidence);
  process.exitCode = result.ok ? 0 : 2;
}

async function executeRoutedCommand(args: string[]): Promise<void> {
  const taskKind = (args[0] ?? "implementation") as TaskKind;
  const codexCommand = readFlag(args, "--codex-command");
  const claudeCommand = readFlag(args, "--claude-command");
  const noMetareview = args.includes("--no-metareview");
  const usageRaw = await readCcusage();
  const result = await executeRoutedTask(cwd, {
    taskKind,
    usageRaw,
    codexCommand,
    claudeCommand,
    maxRetries: Number(readFlag(args, "--max-retries") ?? 2),
    metareview: !noMetareview
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.verified || result.fallback ? 0 : 2;
}

async function metareviewAutoCommand(args: string[]): Promise<void> {
  const verifierEvidence = readFlag(args, "--evidence") ?? "Verifier evidence unavailable.";
  const completedBy = (readFlag(args, "--completed-by") ?? "codex") as "claude" | "codex";
  const result = await runAutomatedMetareview(cwd, {
    completedBy,
    verifierEvidence,
    claudeCommand: readFlag(args, "--claude-command"),
    codexCommand: readFlag(args, "--codex-command")
  });
  console.log(result.evidence);
  process.exitCode = result.ok ? 0 : 2;
}

async function compactBackupCommand(args: string[]): Promise<void> {
  const stdin = await readStdin();
  const triggerFlag = readFlag(args, "--trigger");
  const trigger = triggerFlag === "auto" ? "auto" : triggerFlag === "manual" ? "manual" : undefined;
  const result = await createCompactBackup(cwd, {
    trigger,
    stdin,
    claudeCommand: readFlag(args, "--claude-command")
  });
  console.log(JSON.stringify(result, null, 2));
}

async function compactRecordCommand(): Promise<void> {
  const stdin = await readStdin();
  const file = await recordCompactEvent(cwd, stdin);
  fireNotification("Context compacted", `Compact recorded. See ${file}`, "compact-post");
  console.log(file);
}

async function compactRestoreCommand(): Promise<void> {
  console.log(await restoreLatestHandover(cwd));
}

async function statuslineCommand(): Promise<void> {
  const stdin = await readStdin();
  let session: unknown = {};
  try {
    session = stdin.trim() ? JSON.parse(stdin) : {};
  } catch {
    session = {};
  }
  const plan = await readOptional(join(cwd, "plan.md"));
  const usage = await readStatuslineUsage();
  const lineInput = statusLineInputFromSession(session, plan, usage);
  if (lineInput.contextPercent >= 85) {
    fireNotification(
      `Context at ${Math.round(lineInput.contextPercent)}%`,
      "Run /compact <focus hint> before continuing.",
      `context-${Math.round(lineInput.contextPercent)}`
    );
  }
  console.log(formatStatusLine(lineInput));
}

async function notifyCommand(args: string[]): Promise<void> {
  const key = readFlag(args, "--dedup") ?? "manual";
  const title = readFlag(args, "--title") ?? "myorch";
  const message = readFlag(args, "--message") ?? "Human input required";
  const severity = readFlag(args, "--severity") === "critical" ? "critical" : readFlag(args, "--severity") === "warn" ? "warn" : "info";
  const deliver = await shouldNotify(cwd, key);
  await recordNotificationAttempt(cwd, { key, title, message, severity, delivered: deliver });
  console.log(deliver ? "delivered" : "dedup-suppressed");
}

async function guardPlanEditCommand(): Promise<void> {
  const stdin = await readStdin();
  let input: unknown = {};
  try {
    input = stdin.trim() ? JSON.parse(stdin) : {};
  } catch {
    input = {};
  }
  const decision = detectManualPlanCheckboxEdit(input);
  if (decision.block) {
    console.error(decision.reason);
    console.log(parseHookDecision(decision));
    process.exitCode = 2;
    return;
  }
  console.log(parseHookDecision(decision));
}

async function writeSettingsCommand(): Promise<void> {
  await writeFile(join(cwd, ".claude", "settings.json"), JSON.stringify(buildClaudeSettings(), null, 2) + "\n", "utf8");
  console.log(".claude/settings.json written");
}

async function verifyClaudeFiles(): Promise<void> {
  const checks: string[] = [];
  const commandDir = join(cwd, ".claude", "commands");
  const rulesDir = join(cwd, ".claude", "rules");
  const hooksDir = join(cwd, ".claude", "hooks");
  const statuslinePath = join(cwd, ".claude", "statusline.sh");
  const notifyPath = join(cwd, "scripts", "notify.ps1");
  const settingsPath = join(cwd, ".claude", "settings.json");

  const settingsRaw = await readFile(settingsPath, "utf8");
  const settings = JSON.parse(settingsRaw) as ReturnType<typeof buildClaudeSettings>;
  if (!settings.hooks?.PostToolUse?.[0]?.hooks?.[0]?.command.includes("post-tool-use.sh")) {
    throw new Error("settings.json must register PostToolUse post-tool-use.sh");
  }
  if (!settings.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command.includes("pre-tool-use-plan-guard.js")) {
    throw new Error("settings.json must register PreToolUse plan guard");
  }
  if (!settings.hooks?.UserPromptExpansion?.[0]?.hooks?.[0]?.command.includes("goal-start-hook")) {
    throw new Error("settings.json must register UserPromptExpansion goal-start-hook");
  }
  if (!settings.hooks?.PreCompact?.[0]?.hooks?.[0]?.command.includes("compact-backup")) {
    throw new Error("settings.json must register PreCompact compact-backup");
  }
  if (!settings.hooks?.PostCompact?.[0]?.hooks?.[0]?.command.includes("compact-record")) {
    throw new Error("settings.json must register PostCompact compact-record");
  }
  if (!settings.hooks?.SessionStart?.some((group) => group.matcher === "compact" && group.hooks.some((hook) => hook.command.includes("compact-restore")))) {
    throw new Error("settings.json must register SessionStart compact restore");
  }
  if (!settings.statusLine?.command.includes("statusline.sh")) {
    throw new Error("settings.json must register project statusLine");
  }
  checks.push("settings.json: hooks registered");

  const commandFiles = await safeReaddir(commandDir);
  const missingCommands = EXPECTED_SLASH_COMMANDS
    .map((command) => `${command.slice(1)}.md`)
    .filter((file) => !commandFiles.includes(file));
  if (missingCommands.length > 0) {
    throw new Error(`Missing Claude command file(s): ${missingCommands.join(", ")}`);
  }

  for (const file of commandFiles) {
    if (!file.endsWith(".md")) continue;
    const bytes = await readFile(join(commandDir, file));
    const encoding = validateUtf8NoBomLf(bytes);
    if (!encoding.ok) throw new Error(`commands/${file}: ${encoding.message}`);
    const content = bytes.toString("utf8");
    const result = validateClaudeCommandFrontmatter(content);
    if (!result.ok) throw new Error(`commands/${file}: ${result.message}`);
    checks.push(`commands/${file}: Claude command frontmatter ok`);
  }

  for (const file of await safeReaddir(rulesDir)) {
    if (!file.endsWith(".md")) continue;
    const bytes = await readFile(join(rulesDir, file));
    const encoding = validateUtf8NoBomLf(bytes);
    if (!encoding.ok) throw new Error(`rules/${file}: ${encoding.message}`);
    const content = bytes.toString("utf8");
    const result = validateRuleFrontmatter(content);
    if (!result.ok) throw new Error(`rules/${file}: ${result.message}`);
    checks.push(`rules/${file}: rule frontmatter ok`);
  }

  for (const file of await safeReaddir(hooksDir)) {
    const fullPath = join(hooksDir, file);
    if (file.endsWith(".sh")) {
      const result = await checkBashSyntax(fullPath);
      if (!result.ok) throw new Error(result.evidence);
      checks.push(`${file}: bash syntax ok`);
    }
    if (file.endsWith(".ps1")) {
      const result = await checkPowerShellSyntax(fullPath);
      if (!result.ok) throw new Error(result.evidence);
      checks.push(`${file}: powershell syntax ok`);
    }
  }

  const statuslineSyntax = await checkBashSyntax(statuslinePath);
  if (!statuslineSyntax.ok) throw new Error(statuslineSyntax.evidence);
  checks.push("statusline.sh: bash syntax ok");

  const notifySyntax = await checkPowerShellSyntax(notifyPath);
  if (!notifySyntax.ok) throw new Error(notifySyntax.evidence);
  checks.push("scripts/notify.ps1: powershell syntax ok");

  console.log(checks.join("\n") || "No Claude files found.");
}

async function verifyClaudeRuntimeCommand(): Promise<void> {
  const result = await verifyClaudeRuntime(cwd);
  console.log(result.evidence);
  if (!result.ok) process.exitCode = 1;
}

async function readOverride(): Promise<"claude" | "codex" | undefined> {
  try {
    const value = (await readFile(join(cwd, ".myorch", "manual-override"), "utf8")).trim();
    return value === "claude" || value === "codex" ? value : undefined;
  } catch {
    return undefined;
  }
}

async function readCcusage(): Promise<unknown> {
  return readCcusageData({ cwd, env: process.env });
}

async function readStatuslineUsage(): Promise<unknown> {
  if (process.env.CCUSAGE_MOCK_JSON) return JSON.parse(process.env.CCUSAGE_MOCK_JSON);
  const cachePath = join(cwd, ".myorch", "cache", "statusline-ccusage.json");
  const cached = await readJson(cachePath);
  if (cached && typeof cached === "object" && "ts" in cached && Date.now() - Number((cached as { ts: unknown }).ts) < 5_000) {
    return (cached as { value?: unknown }).value ?? {};
  }

  const result = await runCommand("ccusage blocks --json", { cwd, timeoutMs: 700 });
  if (!result.ok) return (cached as { value?: unknown } | undefined)?.value ?? {};
  try {
    const value = JSON.parse(result.stdout);
    await mkdir(join(cwd, ".myorch", "cache"), { recursive: true });
    await writeFile(cachePath, JSON.stringify({ ts: Date.now(), value }), "utf8");
    return value;
  } catch {
    return (cached as { value?: unknown } | undefined)?.value ?? {};
  }
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

async function readRecentFailures(): Promise<number> {
  try {
    const content = await readFile(join(cwd, ".myorch", "memory", "verifier.jsonl"), "utf8");
    return content
      .trim()
      .split(/\r?\n/)
      .slice(-5)
      .filter((line) => {
        try {
          return JSON.parse(line).ok === false;
        } catch {
          return false;
        }
      }).length;
  } catch {
    return 0;
  }
}

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function fireNotification(title: string, message: string, dedup: string): void {
  const script = join(cwd, "scripts", "notify.ps1");
  const child = spawn("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-Title",
    title,
    "-Message",
    message,
    "-Severity",
    "warn",
    "-Dedup",
    dedup,
    "-Root",
    cwd
  ], {
    cwd,
    windowsHide: true,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
