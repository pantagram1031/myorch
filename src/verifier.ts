import { spawn } from "node:child_process";
import { parseFrontmatter, parseFrontmatterPaths } from "./frontmatter.js";
import type { CheckResult, CommandResult } from "./types.js";

const CLAUDE_COMMAND_KEYS = new Set(["description", "argument-hint", "allowed-tools", "model"]);

export function validateFrontmatter(markdown: string): CheckResult {
  return validateRuleFrontmatter(markdown);
}

export function validateRuleFrontmatter(markdown: string): CheckResult {
  try {
    parseFrontmatterPaths(markdown);
    return { ok: true, message: "rule frontmatter ok" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function validateUtf8NoBomLf(content: Buffer): CheckResult {
  if (content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
    return { ok: false, message: "File must be UTF-8 without BOM." };
  }
  const text = content.toString("utf8");
  if (text.includes("\r\n")) {
    return { ok: false, message: "File must use LF line endings, not CRLF." };
  }
  return { ok: true, message: "encoding ok" };
}

export function validateClaudeCommandFrontmatter(markdown: string): CheckResult {
  try {
    const metadata = parseFrontmatter(markdown);
    const description = metadata.description;
    if (typeof description !== "string" || description.trim().length === 0) {
      return { ok: false, message: "Claude command frontmatter requires non-empty description." };
    }

    const unsupported = Object.keys(metadata).filter((key) => !CLAUDE_COMMAND_KEYS.has(key));
    if (unsupported.length > 0) {
      return { ok: false, message: `Unsupported Claude command frontmatter field(s): ${unsupported.join(", ")}` };
    }

    return { ok: true, message: "Claude command frontmatter ok" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function validateJsonSchema(schema: JsonSchema, value: unknown): CheckResult {
  const errors = validateJsonValue(schema, value, "");
  if (errors.length === 0) return { ok: true, message: "json schema ok" };
  return { ok: false, message: errors.join("; ") };
}

export async function runCommand(command: string, options: { cwd?: string; timeoutMs?: number } = {}): Promise<CommandResult> {
  const child = spawn(command, {
    cwd: options.cwd,
    shell: true,
    windowsHide: true
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, options.timeoutMs ?? 120_000);

  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  return new Promise((resolve) => {
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        command,
        exitCode: null,
        stdout,
        stderr: stderr + error.message,
        evidence: `${command}\nERROR ${error.message}`
      });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const ok = code === 0 && !timedOut;
      const suffix = timedOut ? "TIMEOUT" : ok ? "PASS" : "FAIL";
      resolve({
        ok,
        command,
        exitCode: code,
        stdout,
        stderr,
        evidence: `${command}\n${suffix} exit=${code}\n${stdout}${stderr}`.trim()
      });
    });
  });
}

export async function checkBashSyntax(scriptPath: string, bashPath = "C:\\Program Files\\Git\\bin\\bash.exe"): Promise<CommandResult> {
  return runCommand(`"${bashPath}" -n "${scriptPath}"`);
}

export async function checkPowerShellSyntax(scriptPath: string): Promise<CommandResult> {
  return runCommand(`powershell -NoProfile -Command "[ScriptBlock]::Create((Get-Content -Raw '${scriptPath.replaceAll("'", "''")}')) | Out-Null"`);
}

interface JsonSchema {
  type?: "object" | "string" | "number" | "boolean" | "array";
  required?: string[];
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
}

function validateJsonValue(schema: JsonSchema, value: unknown, path: string): string[] {
  const errors: string[] = [];
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path || "/"} must be one of ${schema.enum.join(", ")}`);
  }

  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [`${path || "/"} must be object`];
    }
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${path || "/"}/${key} is required`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in record) errors.push(...validateJsonValue(childSchema, record[key], `${path}/${key}`));
    }
  }

  if (schema.type && schema.type !== "object" && typeof value !== schema.type) {
    errors.push(`${path || "/"} must be ${schema.type}`);
  }

  return errors;
}
