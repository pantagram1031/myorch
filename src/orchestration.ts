import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCodexHandoff } from "./handoff.js";
import { appendMemoryRecord } from "./memory.js";
import { parsePlan } from "./ratchet.js";
import { routeTask, parseCcusage } from "./router.js";
import type { ModelName, TaskKind } from "./types.js";
import { verifyAndAdvancePlan } from "./enforcement.js";
import { runCommand } from "./verifier.js";

export interface ExecuteRoutedOptions {
  taskKind: TaskKind;
  usageRaw?: unknown;
  codexCommand?: string;
  claudeCommand?: string;
  maxRetries?: number;
  metareview?: boolean;
}

export interface ExecuteRoutedResult {
  model: ModelName;
  attempts: number;
  verified: boolean;
  fallback: boolean;
  evidence: string;
}

export interface MetareviewOptions {
  completedBy: ModelName;
  verifierEvidence: string;
  claudeCommand?: string;
  codexCommand?: string;
}

export function packageCurrentTask(planContent: string): string {
  const parsed = parsePlan(planContent);
  const current = parsed.tasks.find((task) => task.current && !task.checked) ?? parsed.tasks.find((task) => !task.checked);
  if (!current) return "No current task remains.";

  const lines = planContent.split(/\r?\n/);
  const block: string[] = [];
  for (let i = current.lineIndex; i < lines.length; i++) {
    if (i !== current.lineIndex && /^\s*-\s\[[ xX]\]/.test(lines[i])) break;
    block.push(lines[i]);
  }

  return [
    "You are Codex implementing one verifier-gated task in a Windows-native Claude Code orchestrator.",
    "Do not edit plan.md checkboxes. The ratchet verifier owns progress.",
    "Use the listed verifier command before reporting success.",
    "",
    "Current task block:",
    block.join("\n")
  ].join("\n");
}

export async function executeRoutedTask(root: string, options: ExecuteRoutedOptions): Promise<ExecuteRoutedResult> {
  const usage = parseCcusage(options.usageRaw ?? {});
  const decision = routeTask({ taskKind: options.taskKind, usage });
  await appendMemoryRecord(root, "routing", { phase: "execute-routed", ...decision });

  if (decision.model === "codex") {
    const prompt = packageCurrentTask(await readFile(join(root, "plan.md"), "utf8"));
    const maxRetries = options.maxRetries ?? 2;
    let lastEvidence = "";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const handoff = await runCodexHandoff({
        codexCommand: options.codexCommand,
        prompt,
        cwd: root
      });
      lastEvidence = handoff.evidence;
      await appendMemoryRecord(root, "handoff", {
        model: "codex",
        attempt,
        ok: handoff.ok,
        fallbackRequired: handoff.fallbackRequired,
        exitCode: handoff.exitCode,
        evidence: handoff.evidence
      });

      if (!handoff.ok) continue;

      const verified = await verifyAndAdvancePlan(root);
      if (verified.ok) {
        if (options.metareview !== false) {
          await runAutomatedMetareview(root, {
            completedBy: "codex",
            verifierEvidence: verified.evidence,
            claudeCommand: options.claudeCommand,
            codexCommand: options.codexCommand
          });
        }
        return { model: "codex", attempts: attempt, verified: true, fallback: false, evidence: verified.evidence };
      }
      lastEvidence = verified.evidence;
    }

    await appendMemoryRecord(root, "routing", {
      phase: "codex-retry-exhausted",
      model: "claude",
      reason: `Codex failed after ${maxRetries} attempt(s); falling back to Claude.`
    });
    return { model: "claude", attempts: maxRetries, verified: false, fallback: true, evidence: lastEvidence };
  }

  const verified = await verifyAndAdvancePlan(root);
  return { model: "claude", attempts: 0, verified: verified.ok, fallback: false, evidence: verified.evidence };
}

export function validateMetareviewText(text: string): { ok: boolean; reason: string } {
  const normalized = text.trim().toLowerCase();
  if (normalized === "looks good" || normalized === "looks good.") {
    return { ok: false, reason: "Metareview cannot be looks-good-only." };
  }
  if (!/verifier evidence|npm test|pass exit=0|fail exit=/i.test(text)) {
    return { ok: false, reason: "Metareview must cite verifier evidence." };
  }
  return { ok: true, reason: "metareview ok" };
}

export async function runAutomatedMetareview(root: string, options: MetareviewOptions): Promise<{ ok: boolean; evidence: string }> {
  const reviewPrompt = [
    "Review the completed task using only verifier evidence.",
    `Completed by: ${options.completedBy}`,
    `Verifier evidence: ${options.verifierEvidence}`,
    "Return a concise assessment that cites verifier evidence."
  ].join("\n");

  const claude = await runClaudeLike(options.claudeCommand ?? "claude", reviewPrompt, root);
  const claudeText = extractClaudeResult(claude.stdout) || claude.evidence;
  const claudeValidation = validateMetareviewText(claudeText);

  const codexPrompt = [
    "Judge whether this review is supported by verifier evidence.",
    `Verifier evidence: ${options.verifierEvidence}`,
    `Review: ${claudeText}`,
    "Reject looks-good-only reviews."
  ].join("\n");
  const codex = await runCodexHandoff({ codexCommand: options.codexCommand, prompt: codexPrompt, cwd: root });
  const codexValidation = validateMetareviewText(codex.stdout || codex.evidence);
  const ok = claude.ok && codex.ok && claudeValidation.ok && codexValidation.ok;
  const evidence = [
    `claude:${claudeText}`,
    `codex:${codex.stdout || codex.evidence}`,
    `valid:${ok}`
  ].join("\n");

  await appendMemoryRecord(root, "metareview", {
    ok,
    completedBy: options.completedBy,
    verifierEvidence: options.verifierEvidence,
    claude: claudeText,
    codex: codex.stdout || codex.evidence,
    evidence
  });

  return { ok, evidence };
}

async function runClaudeLike(command: string, prompt: string, cwd: string) {
  if (/\.cmd$/i.test(command) || command !== "claude") {
    return runCommand(`${quote(command)} -p ${quote(prompt)} --output-format json`, { cwd, timeoutMs: 120_000 });
  }
  return runCommand(`claude -p ${quote(prompt)} --output-format json`, { cwd, timeoutMs: 120_000 });
}

function extractClaudeResult(stdout: string): string | undefined {
  try {
    const parsed = JSON.parse(stdout) as { result?: string };
    return parsed.result;
  } catch {
    return stdout.trim() || undefined;
  }
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
