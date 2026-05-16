import { runCommand } from "./verifier.js";

export const EXPECTED_SLASH_COMMANDS = [
  "/goal",
  "/next",
  "/pause",
  "/resume",
  "/review",
  "/status",
  "/switch",
  "/metareview",
  "/ratchet",
  "/routing"
] as const;

export interface ClaudeRuntimeCheck {
  ok: boolean;
  recognized: string[];
  missing: string[];
  evidence: string;
}

export function parseSlashCommandsFromClaudeJson(jsonText: string): string[] {
  const parsed = JSON.parse(jsonText) as unknown;
  const commands = new Set<string>();
  collectSlashCommands(parsed, commands);
  return [...commands].sort();
}

export function findMissingSlashCommands(expected: readonly string[], recognized: readonly string[]): string[] {
  const available = new Set(recognized);
  return expected.filter((command) => !available.has(command));
}

export async function verifyClaudeRuntime(cwd: string): Promise<ClaudeRuntimeCheck> {
  const prompt = "List the slash commands available in this session exactly as command names only.";
  const result = await runCommand(`claude -p "${prompt}" --output-format json`, { cwd, timeoutMs: 120_000 });
  if (!result.ok) {
    return {
      ok: false,
      recognized: [],
      missing: [...EXPECTED_SLASH_COMMANDS],
      evidence: result.evidence
    };
  }

  let recognized: string[];
  try {
    recognized = parseSlashCommandsFromClaudeJson(result.stdout);
  } catch (error) {
    return {
      ok: false,
      recognized: [],
      missing: [...EXPECTED_SLASH_COMMANDS],
      evidence: `Claude runtime JSON parse failed: ${error instanceof Error ? error.message : String(error)}\n${result.stdout}`
    };
  }

  const missing = findMissingSlashCommands(EXPECTED_SLASH_COMMANDS, recognized);
  return {
    ok: missing.length === 0,
    recognized,
    missing,
    evidence: `recognized=${recognized.join(", ")}\nmissing=${missing.join(", ") || "none"}`
  };
}

function collectSlashCommands(value: unknown, commands: Set<string>): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(/(^|\s)(\/[A-Za-z0-9:_-]+)\b/g)) {
      commands.add(match[2]);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectSlashCommands(item, commands);
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectSlashCommands(item, commands);
  }
}
