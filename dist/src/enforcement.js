import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { advanceRatchet, parsePlan } from "./ratchet.js";
import { runCommand } from "./verifier.js";
import { appendMemoryRecord } from "./memory.js";
export function buildClaudeSettings() {
    return {
        hooks: {
            PreToolUse: [
                {
                    matcher: "Edit|Write",
                    hooks: [
                        {
                            type: "command",
                            command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/pre-tool-use-plan-guard.js"
                        }
                    ]
                }
            ],
            UserPromptExpansion: [
                {
                    matcher: "goal",
                    hooks: [
                        {
                            type: "command",
                            command: "myorch goal-start-hook"
                        }
                    ]
                }
            ],
            PostToolUse: [
                {
                    matcher: "Edit|Write|Bash",
                    hooks: [
                        {
                            type: "command",
                            command: "${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.sh"
                        }
                    ]
                }
            ],
            PreCompact: [
                {
                    hooks: [
                        {
                            type: "command",
                            command: "myorch compact-backup"
                        }
                    ]
                }
            ],
            PostCompact: [
                {
                    hooks: [
                        {
                            type: "command",
                            command: "myorch compact-record"
                        }
                    ]
                }
            ],
            PermissionDenied: [
                {
                    matcher: "*",
                    hooks: [
                        {
                            type: "command",
                            command: "myorch notify --title \"Human input needed\" --message \"Claude Code permission denied a tool call.\" --severity warn --dedup permission-denied"
                        }
                    ]
                }
            ],
            SessionStart: [
                {
                    matcher: "compact",
                    hooks: [
                        {
                            type: "command",
                            command: "myorch compact-restore"
                        }
                    ]
                }
            ]
        },
        statusLine: {
            type: "command",
            command: "${CLAUDE_PROJECT_DIR}/.claude/statusline.sh",
            padding: 0,
            refreshInterval: 5
        }
    };
}
export function detectManualPlanCheckboxEdit(input) {
    const event = asRecord(input);
    const toolInput = asRecord(event?.tool_input);
    const path = String(toolInput?.file_path ?? toolInput?.path ?? "");
    const oldText = String(toolInput?.old_string ?? toolInput?.content ?? "");
    const newText = String(toolInput?.new_string ?? toolInput?.content ?? "");
    const text = `${oldText}\n${newText}`;
    if (!/plan\.md$/i.test(path.replaceAll("\\", "/")))
        return { block: false };
    if (!/\- \[[ xX]\]/.test(text))
        return { block: false };
    return {
        block: true,
        reason: "plan.md checkbox edits are blocked. Use myorch ratchet advance with verifier evidence."
    };
}
export function parseHookDecision(decision) {
    if (!decision.block)
        return "{}";
    return JSON.stringify({ decision: "block", reason: decision.reason ?? "Blocked by myorch policy." });
}
export async function verifyAndAdvancePlan(root, options = {}) {
    const planPath = join(root, "plan.md");
    const content = await readFile(planPath, "utf8");
    const parsed = parsePlan(content);
    const current = parsed.tasks.find((task) => task.current && !task.checked) ?? parsed.tasks.find((task) => !task.checked);
    if (!current?.verifier) {
        const evidence = "No current verifier found; ratchet did not advance.";
        await appendMemoryRecord(root, "verifier", { task: "none", ok: true, advanced: false, evidence });
        return { ok: true, advanced: false, evidence };
    }
    const commandResult = await runCommand(current.verifier, { cwd: root });
    const next = advanceRatchet(content, { passed: commandResult.ok, evidence: commandResult.evidence });
    if (next.advanced) {
        await writeFile(planPath, next.content, "utf8");
    }
    await appendMemoryRecord(root, "verifier", {
        task: current.title,
        ok: commandResult.ok,
        advanced: next.advanced,
        evidence: commandResult.evidence
    });
    if (commandResult.ok && next.advanced && options.compactHint !== false) {
        await appendMemoryRecord(root, "compact", {
            trigger: "ratchet-pass",
            intent: "Run /compact with current verifier evidence before context pressure."
        });
    }
    return { ok: commandResult.ok, advanced: next.advanced, evidence: commandResult.evidence };
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
