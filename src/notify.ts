import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendMemoryRecord } from "./memory.js";

export type NotificationSeverity = "info" | "warn" | "critical";

export interface NotificationAttempt {
  key: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  delivered: boolean;
  nowMs?: number;
}

export async function shouldNotify(root: string, key: string, ttlMs = 300_000, nowMs = Date.now()): Promise<boolean> {
  const records = await readNotificationRecords(root);
  const last = records
    .filter((record) => record.key === key && record.delivered)
    .sort((a, b) => b.ms - a.ms)[0];
  return !last || nowMs - last.ms >= ttlMs;
}

export async function recordNotificationAttempt(root: string, attempt: NotificationAttempt): Promise<string> {
  await mkdir(join(root, ".myorch", "memory"), { recursive: true });
  return appendMemoryRecord(root, "notifications", {
    key: attempt.key,
    title: attempt.title,
    message: attempt.message,
    severity: attempt.severity,
    delivered: attempt.delivered,
    ms: attempt.nowMs ?? Date.now()
  });
}

async function readNotificationRecords(root: string): Promise<Array<{ key: string; delivered: boolean; ms: number }>> {
  try {
    const content = await readFile(join(root, ".myorch", "memory", "notifications.jsonl"), "utf8");
    return content
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as { key?: unknown; delivered?: unknown; ms?: unknown };
          return {
            key: typeof parsed.key === "string" ? parsed.key : "",
            delivered: parsed.delivered === true,
            ms: typeof parsed.ms === "number" ? parsed.ms : 0
          };
        } catch {
          return { key: "", delivered: false, ms: 0 };
        }
      });
  } catch {
    return [];
  }
}
