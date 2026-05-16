import { parsePlan } from "./ratchet.js";

export interface PlanStatus {
  remaining: number;
  current: string;
}

export interface StatusLineInput {
  model: string;
  costUsd: number;
  blockRemainingMinutes: number | undefined;
  burnRateTokensPerMinute: number | undefined;
  contextPercent: number;
  progress: string;
}

export function summarizePlanStatus(planContent: string): PlanStatus {
  const parsed = parsePlan(planContent);
  const remaining = parsed.tasks.filter((task) => !task.checked).length;
  const current = normalizeTitle(currentUncheckedTitle(parsed) ?? "none");
  return { remaining, current };
}

export function formatProgress(planContent: string): string {
  const parsed = parsePlan(planContent);
  const total = parsed.tasks.length;
  const done = parsed.tasks.filter((task) => task.checked).length;
  const current = normalizeTitle(currentUncheckedTitle(parsed) ?? "none");
  return `[${done}/${total} done] Current: ${current}`;
}

export function formatStatusLine(input: StatusLineInput): string {
  const warning = input.contextPercent >= 75 ? " ⚠️ WARNING" : "";
  const remaining = input.blockRemainingMinutes === undefined ? "?m" : `${Math.round(input.blockRemainingMinutes)}m`;
  const burn = input.burnRateTokensPerMinute === undefined ? "? tok/min" : `${Math.round(input.burnRateTokensPerMinute)} tok/min`;
  return [
    `[${input.model || "model?"}]`,
    `$${input.costUsd.toFixed(2)}`,
    `5h:${remaining}`,
    burn,
    `ctx:${Math.round(input.contextPercent)}%${warning}`,
    input.progress
  ].join(" | ");
}

export function statusLineInputFromSession(session: unknown, planContent: string, ccusage: unknown = {}): StatusLineInput {
  const record = asRecord(session);
  const model = asRecord(record?.model);
  const cost = asRecord(record?.cost);
  const context = asRecord(record?.context_window);
  return {
    model: stringValue(model?.display_name) ?? stringValue(model?.id) ?? "claude",
    costUsd: numberValue(cost?.total_cost_usd) ?? numberValue(record?.total_cost_usd) ?? 0,
    blockRemainingMinutes: blockRemainingMinutes(ccusage),
    burnRateTokensPerMinute: burnRate(ccusage),
    contextPercent: numberValue(context?.used_percentage) ?? numberValue(record?.context_percent) ?? 0,
    progress: formatProgress(planContent)
  };
}

function normalizeTitle(title: string): string {
  return title
    .replace(/^\?\?current\s*/, "")
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .replace(/^Task\s+\d+:\s*/i, "")
    .trim();
}

function currentUncheckedTitle(parsed: ReturnType<typeof parsePlan>): string | undefined {
  return parsed.tasks.find((task) => task.current && !task.checked)?.title
    ?? parsed.tasks.find((task) => !task.checked)?.title;
}

function blockRemainingMinutes(raw: unknown): number | undefined {
  const root = asRecord(raw);
  const active = activeBlock(root);
  return numberValue(root?.blockRemainingMinutes)
    ?? numberValue(root?.remainingMinutes)
    ?? numberValue(asRecord(active?.projection)?.remainingMinutes)
    ?? numberValue(asRecord(root?.block)?.remainingMinutes)
    ?? numberValue(asRecord(root?.billingBlock)?.remainingMinutes)
    ?? numberValue(asRecord(root?.fiveHourBlock)?.remainingMinutes);
}

function burnRate(raw: unknown): number | undefined {
  const root = asRecord(raw);
  const active = activeBlock(root);
  return numberValue(root?.burnRateTokensPerMinute)
    ?? numberValue(root?.tokensPerMinute)
    ?? numberValue(asRecord(active?.burnRate)?.tokensPerMinute)
    ?? numberValue(asRecord(root?.burnRate)?.tokensPerMinute)
    ?? numberValue(asRecord(root?.burn_rate)?.tokens_per_minute);
}

function activeBlock(root: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const blocks = Array.isArray(root?.blocks) ? root.blocks : [];
  return blocks.map(asRecord).find((block) => block?.isActive === true);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
