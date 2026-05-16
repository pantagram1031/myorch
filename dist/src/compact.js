import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appendMemoryRecord } from "./memory.js";
import { parsePlan } from "./ratchet.js";
import { runCommand } from "./verifier.js";
export async function createCompactBackup(root, options = {}) {
    const trigger = options.trigger ?? detectTrigger(options.stdin);
    const timestamp = timestampId();
    const backupDir = join(root, ".myorch", "backups", `precompact-${timestamp}`);
    const handoverDir = join(root, ".myorch", "handover");
    const handoverPath = join(handoverDir, `handover-${timestamp}.md`);
    await mkdir(join(backupDir, "memory"), { recursive: true });
    await mkdir(handoverDir, { recursive: true });
    await copyIfExists(join(root, "plan.md"), join(backupDir, "plan.md"));
    await copyIfExists(join(root, "spec.md"), join(backupDir, "spec.md"));
    await copyIfExists(join(root, "assumptions.md"), join(backupDir, "assumptions.md"));
    await copyMemory(root, join(backupDir, "memory"));
    const plan = await readOptional(join(root, "plan.md"));
    const customInstructions = readCustomInstructions(options.stdin);
    const generated = await generateClaudeSummary(root, options.claudeCommand);
    const handover = [
        "# Compact Handover",
        "",
        `Backup: ${backupDir}`,
        `Trigger: ${trigger}`,
        `Current task: ${currentTask(plan)}`,
        `Remaining tasks: ${remainingTasks(plan)}`,
        "",
        "## Recent Verifier Evidence",
        await tailMemory(root, "verifier"),
        "",
        "## Recent Routing Decisions",
        await tailMemory(root, "routing"),
        "",
        "## Claude Summary",
        generated,
        "",
        "## Focus Hint",
        customInstructions || "Resume from the current ratchet task and cite verifier evidence before advancing."
    ].join("\n");
    await writeFile(handoverPath, handover + "\n", "utf8");
    await writeFile(join(backupDir, "metadata.json"), JSON.stringify({
        trigger,
        customInstructions,
        handoverPath,
        createdAt: new Date().toISOString()
    }, null, 2) + "\n", "utf8");
    await appendMemoryRecord(root, "compact", {
        trigger: "precompact",
        compactTrigger: trigger,
        backupDir,
        handoverPath
    });
    return { trigger, backupDir, handoverPath };
}
export async function recordCompactEvent(root, stdin = "") {
    const summary = readCompactSummary(stdin);
    const latest = await findLatestHandover(root);
    const file = await appendMemoryRecord(root, "compact", {
        trigger: "postcompact",
        summary,
        handoverPath: latest
    });
    return file;
}
export async function restoreLatestHandover(root) {
    const latest = await findLatestHandover(root);
    const plan = await readOptional(join(root, "plan.md"));
    const current = currentTask(plan);
    if (!latest) {
        return `Compact restart session. No recent handover file. Current plan.md task: ${current}.`;
    }
    const content = await readFile(latest, "utf8");
    return [
        `Compact restart session. Backup path: ${latest}. Current plan.md task: ${current}.`,
        "",
        content
    ].join("\n");
}
function detectTrigger(stdin = "") {
    try {
        const parsed = JSON.parse(stdin);
        return parsed.trigger === "auto" ? "auto" : "manual";
    }
    catch {
        return "manual";
    }
}
function readCustomInstructions(stdin = "") {
    try {
        const parsed = JSON.parse(stdin);
        const value = parsed.custom_instructions ?? parsed.customInstructions;
        return typeof value === "string" ? value.trim() : "";
    }
    catch {
        return "";
    }
}
function readCompactSummary(stdin = "") {
    try {
        const parsed = JSON.parse(stdin);
        const value = parsed.compact_summary ?? parsed.summary;
        return typeof value === "string" ? value : "";
    }
    catch {
        return "";
    }
}
async function copyMemory(root, targetDir) {
    const memoryDir = join(root, ".myorch", "memory");
    let files = [];
    try {
        files = await readdir(memoryDir);
    }
    catch {
        return;
    }
    await Promise.all(files
        .filter((file) => file.endsWith(".jsonl"))
        .map((file) => cp(join(memoryDir, file), join(targetDir, file), { force: true })));
}
async function copyIfExists(from, to) {
    try {
        await cp(from, to, { force: true });
    }
    catch {
        // Optional context file.
    }
}
async function readOptional(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch {
        return "";
    }
}
async function tailMemory(root, kind, lines = 3) {
    const content = await readOptional(join(root, ".myorch", "memory", `${kind}.jsonl`));
    return content.trim().split(/\r?\n/).filter(Boolean).slice(-lines).join("\n") || "none";
}
async function generateClaudeSummary(root, command) {
    if (!command)
        return "Skipped: no claude command configured for compact backup.";
    const prompt = "Summarize current ratchet state in 8 bullets or fewer. Cite plan.md and verifier evidence only.";
    const result = await runCommand(`${command} -p "${prompt}" --output-format json`, { cwd: root, timeoutMs: 60_000 });
    return result.ok ? result.stdout.trim() : `Summary unavailable: ${result.evidence}`;
}
async function findLatestHandover(root) {
    const dir = join(root, ".myorch", "handover");
    try {
        const files = (await readdir(dir)).filter((file) => /^handover-.*\.md$/.test(file)).sort();
        const latest = files.at(-1);
        return latest ? join(dir, latest) : undefined;
    }
    catch {
        return undefined;
    }
}
function currentTask(plan) {
    const parsed = parsePlan(plan);
    const title = parsed.tasks.find((task) => task.current && !task.checked)?.title
        ?? parsed.tasks.find((task) => !task.checked)?.title
        ?? "none";
    return title.replace(/^\?\?current\s*/, "").trim();
}
function remainingTasks(plan) {
    return parsePlan(plan).tasks.filter((task) => !task.checked).length;
}
function timestampId() {
    return `${Date.now()}-${process.pid}`;
}
