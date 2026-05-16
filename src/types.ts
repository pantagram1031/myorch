export type ModelName = "claude" | "codex";

export type TaskKind = "planning" | "evaluation" | "implementation" | "metareview";

export interface UsageSnapshot {
  claudePercent?: number;
  codexPercent?: number;
  warnings: string[];
  raw?: unknown;
}

export interface RouteInput {
  taskKind: TaskKind;
  usage?: UsageSnapshot;
  manualOverride?: ModelName;
  recentFailures?: number;
}

export interface RouteDecision {
  model: ModelName;
  reason: string;
  warnings: string[];
}

export interface CheckResult {
  ok: boolean;
  message: string;
}

export interface CommandResult {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  evidence: string;
}
