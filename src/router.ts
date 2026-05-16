import type { ModelName, RouteDecision, RouteInput, TaskKind, UsageSnapshot } from "./types.js";

const DEFAULT_BY_KIND: Record<TaskKind, ModelName> = {
  planning: "claude",
  evaluation: "claude",
  implementation: "codex",
  metareview: "codex"
};

const LIMIT_PERCENT = 80;

export function parseCcusage(raw: unknown): UsageSnapshot {
  const warnings: string[] = [];
  const snapshot: UsageSnapshot = { warnings, raw };

  const root = asRecord(raw);
  const models = asRecord(root?.models);
  const claude = percentFromModel(asRecord(models?.claude));
  const codex = percentFromModel(asRecord(models?.codex));
  const blockPercent = percentFromActiveBlock(root);

  if (claude !== undefined) snapshot.claudePercent = claude;
  if (codex !== undefined) snapshot.codexPercent = codex;
  if (claude === undefined && codex === undefined && blockPercent !== undefined) {
    snapshot.claudePercent = blockPercent;
  }

  if (claude === undefined && codex === undefined) {
    if (Array.isArray(root?.daily) && asRecord(root?.totals)) {
      warnings.push("ccusage daily totals do not include model limits; threshold routing unavailable without block data.");
    } else if (blockPercent === undefined) {
      warnings.push("Malformed ccusage data: expected models.claude/codex used and limit values or active ccusage block data.");
    }
  }

  return snapshot;
}

export function routeTask(input: RouteInput): RouteDecision {
  const warnings = [...(input.usage?.warnings ?? [])];

  if (input.manualOverride) {
    return {
      model: input.manualOverride,
      reason: `manual override selected ${input.manualOverride}`,
      warnings
    };
  }

  if ((input.recentFailures ?? 0) >= 2) {
    return {
      model: "claude",
      reason: "recent verifier failures require Claude evaluation before more implementation",
      warnings
    };
  }

  const preferred = DEFAULT_BY_KIND[input.taskKind];
  const other: ModelName = preferred === "claude" ? "codex" : "claude";
  const percent = preferred === "claude" ? input.usage?.claudePercent : input.usage?.codexPercent;

  if (percent !== undefined && percent >= LIMIT_PERCENT) {
    return {
      model: other,
      reason: `${preferred} usage ${percent.toFixed(1)}% is at or above ${LIMIT_PERCENT}%, routing to ${other}`,
      warnings
    };
  }

  return {
    model: preferred,
    reason: `${input.taskKind} defaults to ${preferred}`,
    warnings
  };
}

function percentFromModel(model: Record<string, unknown> | undefined): number | undefined {
  if (!model) return undefined;
  if (typeof model.percent === "number") return model.percent;
  const used = numberValue(model.used);
  const limit = numberValue(model.limit);
  if (used === undefined || limit === undefined || limit <= 0) return undefined;
  return (used / limit) * 100;
}

function percentFromActiveBlock(root: Record<string, unknown> | undefined): number | undefined {
  const blocks = Array.isArray(root?.blocks) ? root.blocks : [];
  const active = blocks.map(asRecord).find((block) => block?.isActive === true);
  if (!active) return undefined;
  const startMs = Date.parse(String(active.startTime ?? ""));
  const endMs = Date.parse(String(active.endTime ?? ""));
  const actualMs = Date.parse(String(active.actualEndTime ?? ""));
  const nowMs = Number.isFinite(actualMs) ? actualMs : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return undefined;
  return Math.max(0, Math.min(100, ((nowMs - startMs) / (endMs - startMs)) * 100));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
