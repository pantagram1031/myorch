# v2.0 Autonomous Operation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v2.0 autonomous operation with token-aware authority transfer, reset handling, usage insights, sandboxed OSS exploration, progress/git automation, and scenario coverage.

**Architecture:** Add focused modules that share JSONL memory helpers and are invoked through `src/cli.ts`. `token-guard.ts` is the authority source; `reasoning-decider.ts`, `autonomous-loop.ts`, and `oss-explorer.ts` consume its decisions rather than duplicating policy. Existing verifier and scenario infrastructure remains the outer ratchet.

**Tech Stack:** Node.js, TypeScript, built-in `node:test`, Claude Code project files, Codex CLI subprocesses, `ccusage blocks --json`, Git CLI, GitHub CLI where available.

---

## File Map

- Create `src/token-guard.ts`: token mode calculation, reset detection, schema drift tracking, verification exception budget, confirm/reject reset.
- Create `tests/token-guard.test.ts`: token mode, reset, schema drift, Claude-paused blocking.
- Create `src/reasoning-decider.ts`: model and reasoning effort decisions.
- Create `tests/reasoning-decider.test.ts`: Claude/Codex decision matrix.
- Create `src/usage-insight.ts`: five-cycle insight markdown.
- Create `tests/usage-insight.test.ts`: insight aggregation.
- Create `src/autonomous-loop.ts`: next-goal selection, safety guards, sleep/resume.
- Create `tests/autonomous-loop.test.ts`: Codex-only behavior and halt guards.
- Create `src/oss-explorer.ts`: research candidate evaluation, protected-path downgrade, pending merge records.
- Create `tests/oss-explorer.test.ts`: sandbox-install and protected deferral.
- Create `src/progress.ts`: PROGRESS.md, progress JSONL, sanitize, commit/push orchestration.
- Create `tests/progress.test.ts`: progress append and push failure counting.
- Modify `src/cli.ts`: add `resume`, `confirm-reset`, `reject-reset`, `oss-review`, token guard helpers.
- Modify `scripts/run-scenarios.mjs`: add scenarios 13-18.
- Modify `src/init.ts`: seed `ROADMAP.md` and `.myorch/protected-paths.json`.
- Modify `.claude/myorch.md` and `CLAUDE.md`: add v2 critical token/autonomy rules.

---

### Task 1: Token Guard Core

**Files:**
- Create: `src/token-guard.ts`
- Create: `tests/token-guard.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests for token modes**

Add `tests/token-guard.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { decideAuthorityMode } from "../src/token-guard.js";

test("token guard maps ccusage percent to authority modes", () => {
  assert.equal(decideAuthorityMode({ percent: 49 }).mode, "normal");
  assert.equal(decideAuthorityMode({ percent: 50 }).mode, "efficient");
  assert.equal(decideAuthorityMode({ percent: 66 }).mode, "codex-leaning");
  assert.equal(decideAuthorityMode({ percent: 70 }).mode, "claude-paused");
  assert.equal(decideAuthorityMode({ percent: 92 }).mode, "halt");
});

test("claude-paused blocks autonomous Claude calls", () => {
  const decision = decideAuthorityMode({ percent: 71 });
  assert.equal(decision.allowClaudeAutonomous, false);
  assert.equal(decision.allowCcusage, true);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/token-guard.test.ts`

Expected: FAIL because `../src/token-guard.js` does not exist.

- [ ] **Step 3: Add minimal token guard types and implementation**

Add to `src/types.ts`:

```ts
export type AuthorityMode = "normal" | "efficient" | "codex-leaning" | "claude-paused" | "halt";
```

Create `src/token-guard.ts`:

```ts
import type { AuthorityMode } from "./types.js";

export interface TokenSnapshot {
  percent: number;
  blockId?: string;
  startTime?: string;
  endTime?: string;
  resetTime?: string;
  observedAt?: string;
}

export interface AuthorityDecision {
  mode: AuthorityMode;
  allowClaudeAutonomous: boolean;
  allowCodex: boolean;
  allowCcusage: boolean;
  shouldHalt: boolean;
  reason: string;
}

export function decideAuthorityMode(snapshot: Pick<TokenSnapshot, "percent">): AuthorityDecision {
  const percent = snapshot.percent;
  if (percent >= 92) return decision("halt", false, false, true, true, "token percent >= 92");
  if (percent >= 70) return decision("claude-paused", false, true, true, false, "token percent >= 70");
  if (percent >= 65) return decision("codex-leaning", true, true, true, false, "token percent >= 65");
  if (percent >= 50) return decision("efficient", true, true, true, false, "token percent >= 50");
  return decision("normal", true, true, true, false, "token percent < 50");
}

function decision(
  mode: AuthorityMode,
  allowClaudeAutonomous: boolean,
  allowCodex: boolean,
  allowCcusage: boolean,
  shouldHalt: boolean,
  reason: string
): AuthorityDecision {
  return { mode, allowClaudeAutonomous, allowCodex, allowCcusage, shouldHalt, reason };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/token-guard.test.ts`

Expected: PASS for the new token mode tests.

- [ ] **Step 5: Run full verification slice**

Run: `npm test`

Expected: all tests PASS.

---

### Task 2: Block Reset And Schema Drift

**Files:**
- Modify: `src/token-guard.ts`
- Modify: `tests/token-guard.test.ts`

- [ ] **Step 1: Write failing reset tests**

Append to `tests/token-guard.test.ts`:

```ts
import { detectBlockReset, recordCcusageShapeMiss } from "../src/token-guard.js";

test("block reset uses block id with high confidence", () => {
  const reset = detectBlockReset(
    { percent: 74, blockId: "old", observedAt: "2026-05-17T00:00:00.000Z" },
    { percent: 2, blockId: "new", observedAt: "2026-05-17T00:05:00.000Z" }
  );
  assert.deepEqual(reset, { reset: true, confidence: "high", reason: "active block id changed" });
});

test("low confidence reset requires configured percent drop and time gap", () => {
  const reset = detectBlockReset(
    { percent: 72, observedAt: "2026-05-17T00:00:00.000Z" },
    { percent: 10, observedAt: "2026-05-17T04:01:00.000Z" }
  );
  assert.equal(reset.reset, true);
  assert.equal(reset.confidence, "low");
});

test("schema drift reaches notification threshold after three misses", () => {
  const first = recordCcusageShapeMiss({ count: 0 }, { unexpected: true });
  const second = recordCcusageShapeMiss(first.state, { unexpected: true });
  const third = recordCcusageShapeMiss(second.state, { unexpected: true });
  assert.equal(third.shouldNotify, true);
  assert.equal(third.state.count, 3);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/token-guard.test.ts`

Expected: FAIL because reset functions are missing.

- [ ] **Step 3: Implement reset and schema drift helpers**

Append to `src/token-guard.ts`:

```ts
export type ResetConfidence = "high" | "medium" | "low";

export interface ResetDecision {
  reset: boolean;
  confidence?: ResetConfidence;
  reason: string;
}

export interface ShapeMissState {
  count: number;
}

export function detectBlockReset(
  previous: TokenSnapshot | undefined,
  current: TokenSnapshot,
  config = { percentDropThreshold: 50, timeGapHours: 4 }
): ResetDecision {
  if (!previous) return { reset: false, reason: "no previous snapshot" };
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

export function recordCcusageShapeMiss(state: ShapeMissState, raw: unknown): { state: ShapeMissState; shouldNotify: boolean; sanitized: string } {
  const next = { count: state.count + 1 };
  return {
    state: next,
    shouldNotify: next.count >= 3,
    sanitized: JSON.stringify(raw).slice(0, 1000)
  };
}

function blockWindowKey(snapshot: TokenSnapshot): string | undefined {
  const parts = [snapshot.startTime, snapshot.endTime, snapshot.resetTime].filter(Boolean);
  return parts.length > 0 ? parts.join("|") : undefined;
}

function hoursBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return Math.abs(Date.parse(b) - Date.parse(a)) / 3_600_000;
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/token-guard.test.ts`

Expected: PASS.

---

### Task 3: Reasoning Decider

**Files:**
- Create: `src/reasoning-decider.ts`
- Create: `tests/reasoning-decider.test.ts`

- [ ] **Step 1: Write failing decision matrix tests**

Create `tests/reasoning-decider.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { decideClaudeModel, decideCodexEffort } from "../src/reasoning-decider.js";

test("Claude model follows authority mode", () => {
  assert.equal(decideClaudeModel("normal").model, "opus");
  assert.equal(decideClaudeModel("efficient").model, "sonnet");
  assert.equal(decideClaudeModel("codex-leaning").model, "haiku");
  assert.equal(decideClaudeModel("claude-paused").allowed, false);
});

test("Codex reasoning effort follows remaining percent when supported", () => {
  assert.equal(decideCodexEffort({ remainingPercent: 41, supportsReasoningEffort: true }).effort, "high");
  assert.equal(decideCodexEffort({ remainingPercent: 30, supportsReasoningEffort: true }).effort, "medium");
  assert.equal(decideCodexEffort({ remainingPercent: 19, supportsReasoningEffort: true }).effort, "low");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/reasoning-decider.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement minimal decider**

Create `src/reasoning-decider.ts`:

```ts
import type { AuthorityMode } from "./types.js";

export type ClaudeModel = "opus" | "sonnet" | "haiku";
export type CodexEffort = "high" | "medium" | "low" | "unavailable";

export function decideClaudeModel(mode: AuthorityMode): { allowed: boolean; model?: ClaudeModel; reason: string } {
  if (mode === "normal") return { allowed: true, model: "opus", reason: "normal mode" };
  if (mode === "efficient") return { allowed: true, model: "sonnet", reason: "efficient mode" };
  if (mode === "codex-leaning") return { allowed: true, model: "haiku", reason: "approval trigger only" };
  return { allowed: false, reason: "Claude disabled by authority mode" };
}

export function decideCodexEffort(input: { remainingPercent: number; supportsReasoningEffort: boolean }): { effort: CodexEffort; reason: string } {
  if (!input.supportsReasoningEffort) return { effort: "unavailable", reason: "Codex CLI effort flag unavailable" };
  if (input.remainingPercent > 40) return { effort: "high", reason: "remaining percent > 40" };
  if (input.remainingPercent >= 20) return { effort: "medium", reason: "remaining percent between 20 and 40" };
  return { effort: "low", reason: "remaining percent < 20" };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/reasoning-decider.test.ts`

Expected: PASS.

---

### Task 4: Usage Insight

**Files:**
- Create: `src/usage-insight.ts`
- Create: `tests/usage-insight.test.ts`

- [ ] **Step 1: Write failing insight test**

Create `tests/usage-insight.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { renderUsageInsight } from "../src/usage-insight.js";

test("usage insight renders model efficiency, reasoning effect, transitions, metareview ROI, and OSS adoption", () => {
  const markdown = renderUsageInsight({
    modelStats: [{ model: "codex", tokens: 1000, passCount: 4, taskCount: 5 }],
    reasoningStats: [{ level: "high", passCount: 3, taskCount: 4 }],
    transitions: [{ from: "efficient", to: "claude-paused", count: 2 }],
    metareview: { caughtDefects: 1, reviewedTasks: 4 },
    oss: { accepted: 1, rejected: 3, pending: 1 }
  });
  assert.match(markdown, /Model Token Efficiency/);
  assert.match(markdown, /codex/);
  assert.match(markdown, /Metareview ROI/);
  assert.match(markdown, /OSS Adoption/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/usage-insight.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement renderer**

Create `src/usage-insight.ts`:

```ts
export interface UsageInsightInput {
  modelStats: Array<{ model: string; tokens: number; passCount: number; taskCount: number }>;
  reasoningStats: Array<{ level: string; passCount: number; taskCount: number }>;
  transitions: Array<{ from: string; to: string; count: number }>;
  metareview: { caughtDefects: number; reviewedTasks: number };
  oss: { accepted: number; rejected: number; pending: number };
}

export function renderUsageInsight(input: UsageInsightInput): string {
  return [
    "# Usage Insight",
    "",
    "## Model Token Efficiency",
    ...input.modelStats.map((stat) => `- ${stat.model}: ${stat.tokens} tokens, ${ratio(stat.passCount, stat.taskCount)} PASS ratio`),
    "",
    "## Reasoning Level Effect",
    ...input.reasoningStats.map((stat) => `- ${stat.level}: ${ratio(stat.passCount, stat.taskCount)} PASS ratio`),
    "",
    "## Permission Transition Patterns",
    ...input.transitions.map((transition) => `- ${transition.from} -> ${transition.to}: ${transition.count}`),
    "",
    "## Metareview ROI",
    `- ${input.metareview.caughtDefects} defects caught across ${input.metareview.reviewedTasks} reviewed tasks`,
    "",
    "## OSS Adoption",
    `- accepted=${input.oss.accepted}, rejected=${input.oss.rejected}, pending=${input.oss.pending}`,
    ""
  ].join("\n");
}

function ratio(passCount: number, taskCount: number): string {
  return taskCount === 0 ? "0.00" : (passCount / taskCount).toFixed(2);
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/usage-insight.test.ts`

Expected: PASS.

---

### Task 5: Init Seeds ROADMAP And Protected Paths

**Files:**
- Modify: `src/init.ts`
- Modify: `tests/init.test.ts`

- [ ] **Step 1: Write failing init seed assertions**

Append to the first test in `tests/init.test.ts` after the `.myorch/handover` assertion:

```ts
  assert.equal(await exists(join(root, "ROADMAP.md")), true);
  assert.equal(await exists(join(root, ".myorch", "protected-paths.json")), true);
  const roadmap = await readFile(join(root, "ROADMAP.md"), "utf8");
  assert.match(roadmap, /Priority 1 - Efficiency/);
  assert.match(roadmap, /Success criteria/);
  const protectedPaths = await readFile(join(root, ".myorch", "protected-paths.json"), "utf8");
  assert.match(protectedPaths, /src\/token-guard\.ts/);
  assert.match(protectedPaths, /package\.json/);
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/init.test.ts`

Expected: FAIL because `ROADMAP.md` and protected paths are not seeded.

- [ ] **Step 3: Add seed writers**

In `src/init.ts`, add constants near `MYORCH_IGNORE`:

```ts
const ROADMAP_SEED = `# ROADMAP

## Priority 1 - Efficiency

- [ ] Apply token percent policy automatically.

### Success criteria

- [ ] 

- [ ] Detect 5h block reset and restore Claude authority.

### Success criteria

- [ ] 

- [ ] Decide reasoning level autonomously.

### Success criteria

- [ ] 

- [ ] Measure metareview ROI.

### Success criteria

- [ ] 

## Priority 2 - Autonomous Operation

- [ ] Generate autonomous /goal loop.

### Success criteria

- [ ] 

- [ ] Add token guard, automatic sleep, and resume.

### Success criteria

- [ ] 

- [ ] Explore OSS candidates and sandbox-install safe matches.

### Success criteria

- [ ] 

- [ ] Record every autonomous decision.

### Success criteria

- [ ] 

## Priority 3 - Real-World Usability

- [ ] Automatically verify Quick Start in a fresh environment.

### Success criteria

- [ ] 

- [ ] Verify npm install after public transition.

### Success criteria

- [ ] 

- [ ] Keep demo gif placeholder for manual recording.

### Success criteria

- [ ] 

## Priority 4 - Expansion

- [ ] Add macOS/Linux compatibility.

### Success criteria

- [ ] 

- [ ] Add myorch update command.

### Success criteria

- [ ] 

- [ ] Refresh ARCHITECTURE diagrams.

### Success criteria

- [ ] 
`;

const PROTECTED_PATHS_SEED = {
  files: [
    "src/router.ts",
    "src/ratchet.ts",
    "src/enforcement.ts",
    "src/handoff.ts",
    "src/token-guard.ts",
    ".claude/settings.json"
  ],
  packageJsonSections: ["bin", "scripts", "prepare"]
};
```

Call after directory creation:

```ts
  await seedFile(join(root, "ROADMAP.md"), ROADMAP_SEED, result);
  await seedFile(join(root, ".myorch", "protected-paths.json"), JSON.stringify(PROTECTED_PATHS_SEED, null, 2) + "\n", result);
```

Add helper:

```ts
async function seedFile(target: string, content: string, result: InitResult): Promise<void> {
  if (await pathExists(target)) {
    result.skipped.push(relativeDisplay(target));
    return;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  result.created.push(relativeDisplay(target));
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/init.test.ts`

Expected: PASS.

---

### Task 6: Progress And Git Automation

**Files:**
- Create: `src/progress.ts`
- Create: `tests/progress.test.ts`
- Modify: `src/enforcement.ts`

- [ ] **Step 1: Write failing progress tests**

Create `tests/progress.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendProgress } from "../src/progress.js";

test("appendProgress writes human and machine progress records", async () => {
  const root = await mkdtemp(join(tmpdir(), "myorch-progress-"));
  await appendProgress(root, { cycle: 2, task: 3, summary: "token guard pass", evidence: "npm test PASS" });
  const human = await readFile(join(root, "PROGRESS.md"), "utf8");
  const machine = await readFile(join(root, ".myorch", "memory", "progress.jsonl"), "utf8");
  assert.match(human, /cycle 2 task 3/);
  assert.match(machine, /token guard pass/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/progress.test.ts`

Expected: FAIL because `src/progress.ts` is missing.

- [ ] **Step 3: Implement progress append**

Create `src/progress.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ProgressRecord {
  cycle: number;
  task: number;
  summary: string;
  evidence: string;
}

export async function appendProgress(root: string, record: ProgressRecord): Promise<void> {
  const ts = new Date().toISOString();
  const humanPath = join(root, "PROGRESS.md");
  const jsonlPath = join(root, ".myorch", "memory", "progress.jsonl");
  await mkdir(dirname(jsonlPath), { recursive: true });
  const current = await readOptional(humanPath);
  const next = `${current}${current ? "\n" : "# PROGRESS\n\n"}- ${ts} cycle ${record.cycle} task ${record.task}: ${record.summary}\n  - Evidence: ${record.evidence}\n`;
  await writeFile(humanPath, next, "utf8");
  await writeFile(jsonlPath, `${JSON.stringify({ ts, ...record })}\n`, { encoding: "utf8", flag: "a" });
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/progress.test.ts`

Expected: PASS.

---

### Task 7: Autonomous Loop And Safety Guards

**Files:**
- Create: `src/autonomous-loop.ts`
- Create: `tests/autonomous-loop.test.ts`

- [ ] **Step 1: Write failing safety tests**

Create `tests/autonomous-loop.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { chooseNextGoal, evaluateSafetyGuards } from "../src/autonomous-loop.js";

test("autonomous loop chooses first unfinished roadmap item with latest insight", () => {
  const goal = chooseNextGoal({
    roadmap: "# ROADMAP\n\n## Priority 1 - Efficiency\n\n- [x] Done\n- [ ] Apply token percent policy automatically.\n",
    latestInsight: "# Usage Insight\n\nCodex is efficient.",
    mode: "normal"
  });
  assert.match(goal, /Apply token percent policy automatically/);
});

test("safety guard halts after cycle limit", () => {
  const guard = evaluateSafetyGuards({ tokenPercent: 10, cycleCount: 50, consecutivePriorityFailures: 0, pushFailures: 0, roadmapComplete: false });
  assert.equal(guard.halt, true);
  assert.match(guard.reason, /cycle/);
});

test("safety guard halts at token 92", () => {
  const guard = evaluateSafetyGuards({ tokenPercent: 92, cycleCount: 1, consecutivePriorityFailures: 0, pushFailures: 0, roadmapComplete: false });
  assert.equal(guard.halt, true);
  assert.match(guard.reason, /token/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/autonomous-loop.test.ts`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement loop primitives**

Create `src/autonomous-loop.ts`:

```ts
import type { AuthorityMode } from "./types.js";

export interface GoalInput {
  roadmap: string;
  latestInsight: string;
  mode: AuthorityMode;
}

export interface GuardInput {
  tokenPercent: number;
  cycleCount: number;
  consecutivePriorityFailures: number;
  pushFailures: number;
  roadmapComplete: boolean;
}

export function chooseNextGoal(input: GoalInput): string {
  const line = input.roadmap.split(/\r?\n/).find((entry) => entry.startsWith("- [ ] "));
  const task = line?.replace("- [ ] ", "").trim() ?? "Review ROADMAP and report no unfinished tasks";
  return `autonomous start: ${task}. Mode=${input.mode}. Latest insight: ${input.latestInsight.slice(0, 200)}`;
}

export function evaluateSafetyGuards(input: GuardInput): { halt: boolean; reason: string } {
  if (input.tokenPercent >= 92) return { halt: true, reason: "token percent >= 92" };
  if (input.cycleCount >= 50) return { halt: true, reason: "cycle count >= 50" };
  if (input.consecutivePriorityFailures >= 3) return { halt: true, reason: "same priority failed three cycles" };
  if (input.pushFailures >= 5) return { halt: true, reason: "git push failed five times" };
  if (input.roadmapComplete) return { halt: true, reason: "roadmap complete" };
  return { halt: false, reason: "guards clear" };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/autonomous-loop.test.ts`

Expected: PASS.

---

### Task 8: OSS Explorer Sandbox Policy

**Files:**
- Create: `src/oss-explorer.ts`
- Create: `tests/oss-explorer.test.ts`

- [ ] **Step 1: Write failing OSS policy tests**

Create `tests/oss-explorer.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOssCandidate } from "../src/oss-explorer.js";

test("candidate passes sandbox criteria", () => {
  const result = evaluateOssCandidate({
    name: "agent-ratchet",
    stars: 100,
    lastCommitDaysAgo: 20,
    license: "MIT",
    dependencyCount: 5,
    auditOk: true,
    touchedPaths: ["package.json", "src/usage-insight.ts"]
  });
  assert.equal(result.action, "sandbox-install");
});

test("protected path impact downgrades to protected deferred", () => {
  const result = evaluateOssCandidate({
    name: "router-helper",
    stars: 100,
    lastCommitDaysAgo: 20,
    license: "MIT",
    dependencyCount: 5,
    auditOk: true,
    touchedPaths: ["src/router.ts"]
  });
  assert.equal(result.action, "protected-deferred");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/oss-explorer.test.ts`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement evaluator**

Create `src/oss-explorer.ts`:

```ts
export interface OssCandidate {
  name: string;
  stars: number;
  lastCommitDaysAgo: number;
  license: string;
  dependencyCount: number;
  auditOk: boolean;
  touchedPaths: string[];
}

export type OssAction = "sandbox-install" | "rejected" | "protected-deferred";

const ALLOWED_LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);
const PROTECTED = new Set(["src/router.ts", "src/ratchet.ts", "src/enforcement.ts", "src/handoff.ts", "src/token-guard.ts", ".claude/settings.json"]);

export function evaluateOssCandidate(candidate: OssCandidate): { action: OssAction; reason: string } {
  if (candidate.touchedPaths.some((path) => PROTECTED.has(path))) return { action: "protected-deferred", reason: "candidate touches protected path" };
  if (candidate.stars <= 50) return { action: "rejected", reason: "stars <= 50" };
  if (candidate.lastCommitDaysAgo > 183) return { action: "rejected", reason: "last commit older than six months" };
  if (!ALLOWED_LICENSES.has(candidate.license)) return { action: "rejected", reason: "license not allowed" };
  if (candidate.dependencyCount >= 20) return { action: "rejected", reason: "dependency count >= 20" };
  if (!candidate.auditOk) return { action: "rejected", reason: "npm audit failed" };
  return { action: "sandbox-install", reason: "candidate meets sandbox criteria" };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/oss-explorer.test.ts`

Expected: PASS.

---

### Task 9: CLI Commands

**Files:**
- Modify: `src/cli.ts`
- Create: `tests/cli-commands.test.ts`

- [ ] **Step 1: Write failing surface test**

Create `tests/cli-commands.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CLI usage includes v2 autonomous commands", async () => {
  const source = await readFile("src/cli.ts", "utf8");
  assert.match(source, /confirm-reset/);
  assert.match(source, /reject-reset/);
  assert.match(source, /oss-review/);
  assert.match(source, /resume/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --import tsx --test tests/cli-commands.test.ts`

Expected: FAIL until command cases are added.

- [ ] **Step 3: Add command cases**

In `src/cli.ts`, add switch cases:

```ts
    case "resume":
      console.log(JSON.stringify({ command: "resume", status: "sleep-state-read" }, null, 2));
      break;
    case "confirm-reset":
      await appendMemoryRecord(cwd, "decisions", { reason: "manual-reset-decision", decision: "confirm-reset" });
      console.log("confirmed reset");
      break;
    case "reject-reset":
      await appendMemoryRecord(cwd, "decisions", { reason: "manual-reset-decision", decision: "reject-reset" });
      console.log("rejected reset");
      break;
    case "oss-review":
      await ossReviewCommand();
      break;
```

Add helper:

```ts
async function ossReviewCommand(): Promise<void> {
  try {
    console.log(await readFile(join(cwd, ".myorch", "memory", "oss-pending-merge.jsonl"), "utf8"));
  } catch {
    console.log("");
  }
}
```

Update usage string to include `resume|confirm-reset|reject-reset|oss-review`.

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/cli-commands.test.ts`

Expected: PASS.

---

### Task 10: CLAUDE Rules

**Files:**
- Modify: `.claude/myorch.md`
- Modify: `CLAUDE.md`
- Modify: `tests/verifier.test.ts`

- [ ] **Step 1: Write failing rule presence test**

Append to `tests/verifier.test.ts`:

```ts
test("myorch critical rules include v2 token efficiency rules", async () => {
  const content = await import("node:fs/promises").then((fs) => fs.readFile(".claude/myorch.md", "utf8"));
  assert.match(content, /토큰 효율 최우선/);
  assert.match(content, /70%\+ 모드에서 Claude 호출 금지/);
  assert.match(content, /5h 블록 리셋/);
  assert.match(content, /OSS 설치 전 별도 branch/);
  assert.match(content, /모든 자율 결정 침묵 금지/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --import tsx --test tests/verifier.test.ts`

Expected: FAIL until rules are added.

- [ ] **Step 3: Add critical rules**

Append to `.claude/myorch.md` under `## Critical Rules`:

```markdown
- 토큰 효율 최우선. 모드별 정책 엄수.
- 70%+ 모드에서 Claude 호출 금지 (verification-exception 예산 내 제외).
- 5h 블록 리셋 자동 감지, low confidence는 사용자 confirm 대기.
- OSS 설치 전 별도 branch + verify:all 통과 + protected paths 영향 없음 확인.
- 모든 자율 결정 침묵 금지. 10종 jsonl에 기록.
```

Append the same summary to `CLAUDE.md` only if the project-level permanent rules do not already include it.

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test tests/verifier.test.ts`

Expected: PASS.

---

### Task 11: Scenarios 13-18

**Files:**
- Modify: `scripts/run-scenarios.mjs`

- [ ] **Step 1: Add scenario 13 token mode**

Add a scenario that imports the built CLI path through `runNode(["dist/src/cli.js", ...])` or executes direct Node snippets after `npm run build`:

```js
await scenario("scenario13-claude-paused-at-70", async () => {
  const output = await runNode(["-e", "import('./dist/src/token-guard.js').then(({decideAuthorityMode}) => console.log(JSON.stringify(decideAuthorityMode({percent:70}))))"], {});
  if (!output.includes('"mode":"claude-paused"')) throw new Error(output);
  if (!output.includes('"allowClaudeAutonomous":false')) throw new Error(output);
  return { output };
});
```

- [ ] **Step 2: Add scenario 14 block reset**

```js
await scenario("scenario14-block-reset-restores-claude", async () => {
  const code = "import('./dist/src/token-guard.js').then(({detectBlockReset}) => console.log(JSON.stringify(detectBlockReset({percent:80,blockId:'a'},{percent:1,blockId:'b'}))))";
  const output = await runNode(["-e", code], {});
  if (!output.includes('"confidence":"high"')) throw new Error(output);
  return { output };
});
```

- [ ] **Step 3: Add scenario 15 reasoning levels**

```js
await scenario("scenario15-reasoning-decisions", async () => {
  const code = "import('./dist/src/reasoning-decider.js').then((m) => console.log(JSON.stringify([m.decideClaudeModel('normal'),m.decideClaudeModel('efficient'),m.decideCodexEffort({remainingPercent:19,supportsReasoningEffort:true})])))";
  const output = await runNode(["-e", code], {});
  if (!output.includes('"model":"opus"')) throw new Error(output);
  if (!output.includes('"model":"sonnet"')) throw new Error(output);
  if (!output.includes('"effort":"low"')) throw new Error(output);
  return { output };
});
```

- [ ] **Step 4: Add scenario 16 autonomous goal**

```js
await scenario("scenario16-autonomous-goal-one-cycle", async () => {
  const code = "import('./dist/src/autonomous-loop.js').then(({chooseNextGoal}) => console.log(chooseNextGoal({roadmap:'# ROADMAP\\n- [ ] Apply token percent policy automatically.',latestInsight:'# Usage Insight',mode:'normal'})))";
  const output = await runNode(["-e", code], {});
  if (!output.includes("Apply token percent policy automatically")) throw new Error(output);
  return { output };
});
```

- [ ] **Step 5: Add scenario 17 OSS sandbox**

```js
await scenario("scenario17-oss-sandbox-policy", async () => {
  const code = "import('./dist/src/oss-explorer.js').then(({evaluateOssCandidate}) => console.log(JSON.stringify(evaluateOssCandidate({name:'x',stars:100,lastCommitDaysAgo:2,license:'MIT',dependencyCount:1,auditOk:true,touchedPaths:['package.json']}))))";
  const output = await runNode(["-e", code], {});
  if (!output.includes('"action":"sandbox-install"')) throw new Error(output);
  return { output };
});
```

- [ ] **Step 6: Add scenario 18 halt guard**

```js
await scenario("scenario18-safety-guard-cycle-halt", async () => {
  const code = "import('./dist/src/autonomous-loop.js').then(({evaluateSafetyGuards}) => console.log(JSON.stringify(evaluateSafetyGuards({tokenPercent:10,cycleCount:50,consecutivePriorityFailures:0,pushFailures:0,roadmapComplete:false}))))";
  const output = await runNode(["-e", code], {});
  if (!output.includes('"halt":true')) throw new Error(output);
  return { output };
});
```

- [ ] **Step 7: Verify scenarios**

Run: `npm run verify:scenarios`

Expected: existing scenarios plus 13-18 all return `"ok": true`.

---

### Task 12: Full Verification And Push

**Files:**
- `dist/src/*` generated by build
- Git commit metadata

- [ ] **Step 1: Build runtime artifacts**

Run: `npm run build`

Expected: `dist/src/token-guard.js`, `dist/src/reasoning-decider.js`, `dist/src/autonomous-loop.js`, `dist/src/oss-explorer.js`, `dist/src/usage-insight.js`, and `dist/src/progress.js` exist.

- [ ] **Step 2: Run full verification**

Run: `npm run verify:all`

Expected: PASS, including Claude runtime recognition and scenarios 13-18.

- [ ] **Step 3: Sanitize tracked files**

Run:

```powershell
git ls-files | Select-String -Pattern '\.jsonl$|\.log$|backup|handover|debug|verification-report|CLAUDE\.local\.md|node_modules|dist/tests|settings\.local'
```

Expected: no output.

- [ ] **Step 4: Commit and push**

Run:

```powershell
git add src tests scripts .claude CLAUDE.md ROADMAP.md PROGRESS.md docs package.json .gitignore dist/src
git commit -m "Add v2 autonomous operation guardrails"
git push origin master
```

Expected: push succeeds to private `pantagram1031/myorch`.

---

## Plan Self-Review

Spec coverage:
- Token modes and Claude-paused behavior: Tasks 1, 2, 7, 11.
- Verification exception boundaries: Task 1 establishes blocking; implementation should extend CLI/runtime paths during Task 9 if Claude invocation code needs direct gating.
- Reasoning decisions: Task 3.
- Usage insight: Task 4.
- ROADMAP and protected paths seed: Task 5.
- OSS sandbox-install and protected downgrade: Task 8.
- Progress/git automation: Task 6 and Task 12.
- New commands: Task 9.
- Critical rules: Task 10.
- Scenarios 13-18: Task 11.

Known follow-up inside execution:
- If tests reveal existing CLI helper shape differs from snippets, adapt while preserving test assertions and behavior.
- If `npm run verify:scenarios` is too slow during inner TDD, run the targeted scenario first and full command at Task 12.
