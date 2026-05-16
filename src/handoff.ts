import { spawn } from "node:child_process";

export interface CodexHandoffInput {
  codexCommand?: string;
  prompt: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface CodexHandoffResult {
  ok: boolean;
  fallbackRequired: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  evidence: string;
}

export async function runCodexHandoff(input: CodexHandoffInput): Promise<CodexHandoffResult> {
  const command = input.codexCommand ?? "codex";
  let child;
  try {
    if (process.platform === "win32") {
      child = spawn(`${quoteWindowsArg(command)} exec --skip-git-repo-check --cd ${quoteWindowsArg(input.cwd ?? process.cwd())} ${quoteWindowsArg(input.prompt)}`, {
        cwd: input.cwd,
        shell: true,
        windowsHide: true
      });
    } else {
      child = spawn(command, ["exec", input.prompt], {
        cwd: input.cwd,
        shell: false,
        windowsHide: true
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      fallbackRequired: true,
      exitCode: null,
      stdout: "",
      stderr: message,
      evidence: `Codex handoff failed: ${message}`
    };
  }

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, input.timeoutMs ?? 300_000);

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
        fallbackRequired: true,
        exitCode: null,
        stdout,
        stderr: stderr + error.message,
        evidence: `Codex handoff failed: ${error.message}`
      });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const ok = code === 0 && !timedOut;
      const reason = timedOut ? "timed out" : ok ? "completed" : `exited ${code}`;
      resolve({
        ok,
        fallbackRequired: !ok,
        exitCode: code,
        stdout,
        stderr,
        evidence: `Codex handoff ${reason}\n${stdout}${stderr}`.trim()
      });
    });
  });
}

function quoteWindowsArg(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
