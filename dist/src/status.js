import { parsePlan } from "./ratchet.js";
export function summarizePlanStatus(planContent) {
    const parsed = parsePlan(planContent);
    const remaining = parsed.tasks.filter((task) => !task.checked).length;
    const current = normalizeTitle(currentUncheckedTitle(parsed) ?? "none");
    return { remaining, current };
}
export function formatProgress(planContent) {
    const parsed = parsePlan(planContent);
    const total = parsed.tasks.length;
    const done = parsed.tasks.filter((task) => task.checked).length;
    const current = normalizeTitle(currentUncheckedTitle(parsed) ?? "none");
    return `[${done}/${total} done] Current: ${current}`;
}
export function formatStatusLine(input) {
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
export function statusLineInputFromSession(session, planContent, ccusage = {}) {
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
function normalizeTitle(title) {
    return title
        .replace(/^\?\?current\s*/, "")
        .replace(/^\*\*/, "")
        .replace(/\*\*$/, "")
        .replace(/^Task\s+\d+:\s*/i, "")
        .trim();
}
function currentUncheckedTitle(parsed) {
    return parsed.tasks.find((task) => task.current && !task.checked)?.title
        ?? parsed.tasks.find((task) => !task.checked)?.title;
}
function blockRemainingMinutes(raw) {
    const root = asRecord(raw);
    const active = activeBlock(root);
    return numberValue(root?.blockRemainingMinutes)
        ?? numberValue(root?.remainingMinutes)
        ?? numberValue(asRecord(active?.projection)?.remainingMinutes)
        ?? numberValue(asRecord(root?.block)?.remainingMinutes)
        ?? numberValue(asRecord(root?.billingBlock)?.remainingMinutes)
        ?? numberValue(asRecord(root?.fiveHourBlock)?.remainingMinutes);
}
function burnRate(raw) {
    const root = asRecord(raw);
    const active = activeBlock(root);
    return numberValue(root?.burnRateTokensPerMinute)
        ?? numberValue(root?.tokensPerMinute)
        ?? numberValue(asRecord(active?.burnRate)?.tokensPerMinute)
        ?? numberValue(asRecord(root?.burnRate)?.tokensPerMinute)
        ?? numberValue(asRecord(root?.burn_rate)?.tokens_per_minute);
}
function activeBlock(root) {
    const blocks = Array.isArray(root?.blocks) ? root.blocks : [];
    return blocks.map(asRecord).find((block) => block?.isActive === true);
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function numberValue(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function stringValue(value) {
    return typeof value === "string" ? value : undefined;
}
