import type { AuthorityMode } from "./types.js";

export interface VerificationExceptionBudget {
  callsUsed: number;
  tokensUsed: number;
  maxCalls?: number;
  maxTokens?: number;
}

export interface TokenSnapshot {
  percent: number;
  blockId?: string;
  startTime?: string;
  endTime?: string;
  resetTime?: string;
  observedAt?: string;
  verificationBudget?: VerificationExceptionBudget;
}

export interface AuthorityDecision {
  mode: AuthorityMode;
  allowClaudeAutonomous: boolean;
  allowCodex: boolean;
  allowCcusage: boolean;
  allowVerificationException: boolean;
  shouldHalt: boolean;
  reason: string;
}

export type ResetConfidence = "high" | "medium" | "low";

export interface ResetDecision {
  reset: boolean;
  confidence?: ResetConfidence;
  reason: string;
}

export interface ResetDetectionConfig {
  percentDropThreshold: number;
  timeGapHours: number;
}

export interface ShapeMissState {
  count: number;
}

const DEFAULT_MAX_VERIFICATION_CALLS = 20;
const DEFAULT_MAX_VERIFICATION_TOKENS = 50_000;

export function decideAuthorityMode(snapshot: TokenSnapshot): AuthorityDecision {
  const mode = authorityModeForPercent(snapshot.percent);
  const base = decisionForMode(mode);

  if (mode === "claude-paused" && !snapshot.verificationBudget) {
    return { ...base, allowVerificationException: false, reason: "verification-exception-budget-missing" };
  }

  if (mode === "claude-paused" && isVerificationExceptionBudgetExceeded(snapshot.verificationBudget)) {
    return { ...base, allowVerificationException: false, reason: "verification-exception-budget-exceeded" };
  }

  return base;
}

export function detectBlockReset(
  previous: TokenSnapshot | undefined,
  current: TokenSnapshot,
  config: ResetDetectionConfig = { percentDropThreshold: 50, timeGapHours: 4 }
): ResetDecision {
  if (!previous) {
    return { reset: false, reason: "no previous snapshot" };
  }

  if (previous.blockId && current.blockId && previous.blockId !== current.blockId) {
    return { reset: true, confidence: "high", reason: "active block id changed" };
  }

  const previousWindow = blockWindowKey(previous);
  const currentWindow = blockWindowKey(current);
  if (previousWindow && currentWindow && previousWindow !== currentWindow) {
    return { reset: true, confidence: "medium", reason: "active block window changed" };
  }

  const drop = previous.percent - current.percent;
  const gapHours = hoursBetween(previous.observedAt, current.observedAt);
  if (drop >= config.percentDropThreshold && gapHours >= config.timeGapHours) {
    return { reset: true, confidence: "low", reason: "large percent drop after time gap" };
  }

  return { reset: false, reason: "no reset signal" };
}

export function recordCcusageShapeMiss(
  state: ShapeMissState,
  raw: unknown
): { state: ShapeMissState; shouldNotify: boolean; sanitized: string } {
  const nextState = { count: state.count + 1 };
  return {
    state: nextState,
    shouldNotify: nextState.count >= 3,
    sanitized: sanitizeCcusageShape(raw)
  };
}

export function isVerificationExceptionBudgetExceeded(budget?: VerificationExceptionBudget): boolean {
  if (!budget) {
    return false;
  }

  const maxCalls = budget.maxCalls ?? DEFAULT_MAX_VERIFICATION_CALLS;
  const maxTokens = budget.maxTokens ?? DEFAULT_MAX_VERIFICATION_TOKENS;
  return budget.callsUsed > maxCalls || budget.tokensUsed > maxTokens;
}

function authorityModeForPercent(percent: number): AuthorityMode {
  if (percent >= 92) return "halt";
  if (percent >= 70) return "claude-paused";
  if (percent >= 65) return "codex-leaning";
  if (percent >= 50) return "efficient";
  return "normal";
}

function decisionForMode(mode: AuthorityMode): AuthorityDecision {
  switch (mode) {
    case "halt":
      return makeDecision(mode, false, false, true, false, true, "token percent >= 92");
    case "claude-paused":
      return makeDecision(mode, false, true, true, true, false, "token percent >= 70");
    case "codex-leaning":
      return makeDecision(mode, true, true, true, true, false, "token percent >= 65");
    case "efficient":
      return makeDecision(mode, true, true, true, true, false, "token percent >= 50");
    case "normal":
    default:
      return makeDecision(mode, true, true, true, true, false, "token percent < 50");
  }
}

function makeDecision(
  mode: AuthorityMode,
  allowClaudeAutonomous: boolean,
  allowCodex: boolean,
  allowCcusage: boolean,
  allowVerificationException: boolean,
  shouldHalt: boolean,
  reason: string
): AuthorityDecision {
  return { mode, allowClaudeAutonomous, allowCodex, allowCcusage, allowVerificationException, shouldHalt, reason };
}

function blockWindowKey(snapshot: TokenSnapshot): string | undefined {
  const parts = [snapshot.startTime, snapshot.endTime, snapshot.resetTime].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join("|") : undefined;
}

function hoursBetween(a?: string, b?: string): number {
  if (!a || !b) {
    return 0;
  }

  const start = Date.parse(a);
  const end = Date.parse(b);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  if (end <= start) {
    return 0;
  }

  return (end - start) / 3_600_000;
}

function sanitizeCcusageShape(raw: unknown): string {
  try {
    return JSON.stringify(sanitizeValue(raw)).slice(0, 1000);
  } catch {
    return '"[unserializable ccusage shape]"';
  }
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      sanitized[key] = isSecretLikeKey(key) ? "[redacted secret]" : sanitizeValue(child);
    }
    return sanitized;
  }

  return value;
}

function isSecretLikeKey(key: string): boolean {
  return /api[-_]?key|token|secret|password|credential/i.test(key);
}

function redactString(value: string): string {
  return value
    .replace(/[A-Za-z]:\\Users\\[^\\/\s"]+/g, "C:\\Users\\[redacted-user]")
    .replace(/\/Users\/[^\/\s"]+/g, "/Users/[redacted-user]")
    .replace(/\/home\/[^\/\s"]+/g, "/home/[redacted-user]");
}
