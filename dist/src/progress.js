import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appendMemoryRecord } from "./memory.js";
const PROGRESS_HEADER = "# PROGRESS\n\n";
export async function appendProgress(root, record) {
    const progressPath = join(root, "PROGRESS.md");
    const safeRecord = {
        cycle: record.cycle,
        task: record.task,
        summary: sanitizeProgressText(record.summary),
        evidence: sanitizeProgressText(record.evidence)
    };
    const timestamp = new Date().toISOString();
    const current = await readOptional(progressPath);
    const body = `- ${timestamp} cycle ${safeRecord.cycle} task ${safeRecord.task}: ${safeRecord.summary}\n  - Evidence: ${safeRecord.evidence}\n`;
    const next = current ? `${current}${current.endsWith("\n") ? "" : "\n"}${body}` : `${PROGRESS_HEADER}${body}`;
    await mkdir(root, { recursive: true });
    await writeFile(progressPath, next, "utf8");
    await appendMemoryRecord(root, "progress", safeRecord);
}
export function sanitizeProgressText(value) {
    return value
        .replace(/\0/g, "")
        .replace(/[A-Za-z]:\\Users\\[^\\/\s]+|\/Users\/[^/\s]+|\/home\/[^/\s]+/g, "<user>")
        .replace(/\b(?:\.env(?:\.[^/\s]+)?|id_rsa|id_ed25519|.*\.pem|.*\.key)\b/gi, "[redacted]")
        .replace(/\r\n/g, "\n")
        .trim()
        .slice(0, 500);
}
export function nextPushFailureCount(previousFailures, pushSucceeded) {
    return pushSucceeded ? 0 : previousFailures + 1;
}
async function readOptional(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch {
        return "";
    }
}
