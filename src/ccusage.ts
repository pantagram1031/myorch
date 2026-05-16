import { runCommand } from "./verifier.js";

export { parseCcusage } from "./router.js";

export async function readCcusage(options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<unknown> {
  const env = options.env ?? process.env;
  if (env.CCUSAGE_MOCK_JSON) {
    return JSON.parse(env.CCUSAGE_MOCK_JSON);
  }

  const direct = await runCommand("ccusage --json", { cwd: options.cwd, timeoutMs: 20_000 });
  const output = direct.ok ? direct.stdout : (await runCommand("npx ccusage --json", { cwd: options.cwd, timeoutMs: 30_000 })).stdout;
  try {
    const daily = JSON.parse(output) as Record<string, unknown>;
    const blocks = await readBlocks(options.cwd);
    return blocks ? { ...daily, ...blocks } : daily;
  } catch {
    return {};
  }
}

async function readBlocks(cwd?: string): Promise<Record<string, unknown> | undefined> {
  const direct = await runCommand("ccusage blocks --json", { cwd, timeoutMs: 20_000 });
  const output = direct.ok ? direct.stdout : (await runCommand("npx ccusage blocks --json", { cwd, timeoutMs: 30_000 })).stdout;
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
