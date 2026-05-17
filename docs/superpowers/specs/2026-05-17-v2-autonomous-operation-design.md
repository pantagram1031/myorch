# v2.0 Autonomous Operation With Dynamic Authority Transfer

## Purpose

v2.0 turns myorch from a manually triggered ratchet orchestrator into a "leave it running" autonomous operator. The system should either make meaningful progress or stop safely with evidence. It must not quietly burn Claude tokens, mutate protected core files, or install dependencies without a reversible sandbox path.

The central policy is token efficiency: Claude is used for high-leverage planning and approval, while implementation and routine metareview lean toward Codex. Once Claude usage crosses 70% of the active 5h block, autonomous runtime must stop calling Claude entirely.

## Authority Modes

`src/token-guard.ts` owns the token policy and emits the current authority mode before every task unit.

| Claude block percent | Mode | Authority |
|---|---|---|
| 0-50% | Normal | All models allowed. Claude Opus/high effort may be used. Rich metareview allowed. |
| 50-65% | Efficient | Claude defaults to Sonnet. Metareview only for high-priority work. |
| 65-70% | Codex-leaning | Implementation and metareview use Codex. Claude only for final `/goal` approval triggers. |
| 70%+ | Claude-paused | Autonomous runtime must not call Claude. Codex-only operation. `ccusage` remains allowed. |
| 92%+ | Halt | Stop autonomous work, save sleep state and handover, notify the user. |

Every mode transition is appended to `.myorch/memory/permission-transitions.jsonl`.

## Verification Exceptions

Claude-paused mode forbids Claude calls in autonomous runtime. Development and release verification may still use `claude -p` when explicitly marked:

- `MYORCH_TEST_MODE=1`, or
- CLI `--test-mode`.

Only npm verification scripts may set this mode. `src/autonomous-loop.ts` and any Claude invocation code path must reject attempts to enable test mode internally. Verification exceptions have a configurable budget per 5h block: 20 calls or 50k tokens. Normal exception calls are recorded in `decisions.jsonl` with `reason: "verification-exception"`. Budget overflow switches to mocks and records `reason: "verification-exception-budget-exceeded"`. If autonomous runtime tries to call Claude at 70%+, write `halt-reason.jsonl`, notify, and stop.

## 5h Block Reset Detection

`token-guard.ts` compares the active `ccusage blocks --json` snapshot before each task.

1. If active block id/hash exists, reset confidence is `high`.
2. If no id exists, hash `startTime`, `endTime`, or `resetTime`; confidence is `medium`.
3. If shape is insufficient, a reset candidate requires `PERCENT_DROP_THRESHOLD=50` percentage point drop and `TIME_GAP_HOURS=4` since the prior snapshot. This is `low` confidence only.

High and medium confidence resets restore Claude authority and write `.myorch/memory/block-resets.jsonl`. Low confidence resets notify:

```text
Block reset suspected (low confidence).
Reply: myorch confirm-reset -> Claude authority restored
       myorch reject-reset  -> Codex-only continues
(15 minutes without response defaults to reject.)
```

`myorch confirm-reset` and `myorch reject-reset` write `decisions.jsonl` with `reason: "manual-reset-decision"`. Pending low-confidence reset state lives under `.myorch/state/`.

## ccusage Schema Drift

If expected `ccusage` shape is missing for first- or second-tier reset detection, increment `.myorch/state/ccusage-shape-misses.json`. At three misses, send a BurntToast notification:

```text
ccusage output shape unexpected 3 times. Check ccusage version and myorch compatibility.
```

Also append sanitized raw snippets to `.myorch/memory/ccusage-shape-changes.jsonl`. Snippets must avoid prompts, absolute user file paths where possible, and long raw dumps.

## Reasoning Decisions

`src/reasoning-decider.ts` chooses model and reasoning level at call time.

Claude:
- Normal: Opus, high effort.
- Efficient: Sonnet, medium effort.
- Codex-leaning: Haiku only for allowed approval triggers.
- Claude-paused: no Claude call except verification exception budget.

Codex:
- Detect reasoning effort support from `codex --help` or equivalent once and cache it.
- If supported: remaining >40% -> high, 20-40% -> medium, <20% -> low.
- If not supported: choose model/command only and record that effort control is unavailable.

Every reasoning decision writes `.myorch/memory/decisions.jsonl` with model, level, reason, token snapshot, and caller.

## Usage Insight

`src/usage-insight.ts` runs every five autonomous cycles and writes `.myorch/memory/usage-insight-<date>.md`.

It analyzes:
- model-level token efficiency and verifier PASS ratio;
- reasoning level effectiveness;
- permission transition patterns;
- metareview ROI, measured as verifier-missed defects caught by review;
- OSS exploration adoption rate.

`src/autonomous-loop.ts` must read the newest usage insight before choosing the next `/goal`.

## Autonomous Loop

`src/autonomous-loop.ts` runs when the current task is PASS and no next task remains.

Flow:
1. Read `ROADMAP.md`, latest usage insight, token mode, and unfinished priority.
2. Apply safety guards.
3. Pick the next goal.
4. Use Claude or Codex according to token authority.
5. Record all decisions.
6. On PASS, append progress and optionally commit/push.

The loop must not alter protected core files directly. It must never set `MYORCH_TEST_MODE=1`.

## ROADMAP Seed

If `ROADMAP.md` does not exist, `myorch init` creates this seed:

```markdown
# ROADMAP

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
```

If `ROADMAP.md` says "no new dependencies", OSS exploration is disabled.

## OSS Exploration

`src/oss-explorer.ts` runs every ten cycles in `sandbox-install` mode.

Candidate policy:
- Search keywords include "claude code skill", "codex orchestration", "ccusage extension", and "agent ratchet".
- Candidate must have GitHub stars > 50.
- Last commit must be within six months.
- License must be MIT, Apache 2.0, or BSD.
- Dependency count must be under 20.
- `npm audit` must pass.

Sandbox flow:
1. Create a separate branch.
2. Install and integrate the candidate.
3. Run `npm run verify:all`.
4. If PASS and protected paths are untouched, append `.myorch/memory/oss-pending-merge.jsonl`.
5. If FAIL, rollback branch and write `.myorch/memory/oss-rejected.jsonl`.

Protected path handling:
- If a candidate requires changes to protected paths, downgrade to record-only.
- Do not create a pending merge branch.
- Append `.myorch/memory/oss-protected-deferred.jsonl`.
- Notify the user.

Simple dependency additions that only affect `package.json` dependencies and new imports may proceed in sandbox mode.

`myorch oss-review` lists pending merge entries for batch human review. v2.0 does not perform full automatic merge; v2.1 may revisit this after one week of dogfood.

## Protected Paths

`.myorch/protected-paths.json` defines protected areas. If v1.4.2 already created it, reuse and extend it.

Required entries:
- `src/router.ts`
- `src/ratchet.ts`
- `src/enforcement.ts`
- `src/handoff.ts`
- `src/token-guard.ts`
- `.claude/settings.json`
- `package.json` sections: `bin`, `scripts`, and `prepare`

Both `src/oss-explorer.ts` and the PreToolUse hook read this file. The hook blocks direct edits. OSS exploration downgrades to record-only when candidates need protected paths.

## Progress And Git Automation

On each ratchet PASS:
1. Append `PROGRESS.md` for humans.
2. Append `.myorch/memory/progress.jsonl`.
3. Run sanitize checks.
4. Commit with `v2.0 cycle N task M: <summary>`.
5. Push to the current remote.

Git push failures are counted. Five consecutive failures trigger halt and notification.

## Memory Records

v2.0 owns these JSONL files:

| File | Writer |
|---|---|
| `.myorch/memory/decisions.jsonl` | `reasoning-decider.ts`, `token-guard.ts`, `autonomous-loop.ts` |
| `.myorch/memory/permission-transitions.jsonl` | `token-guard.ts` |
| `.myorch/memory/block-resets.jsonl` | `token-guard.ts` |
| `.myorch/memory/research.jsonl` | `oss-explorer.ts` |
| `.myorch/memory/oss-installations.jsonl` | `oss-explorer.ts` |
| `.myorch/memory/oss-rejected.jsonl` | `oss-explorer.ts` |
| `.myorch/memory/oss-pending-merge.jsonl` | `oss-explorer.ts`, `oss-review` command |
| `.myorch/memory/oss-protected-deferred.jsonl` | `oss-explorer.ts` |
| `.myorch/memory/halt-reason.jsonl` | `autonomous-loop.ts`, `token-guard.ts`, safety guards |
| `.myorch/memory/ccusage-shape-changes.jsonl` | `token-guard.ts` |
| `.myorch/memory/progress.jsonl` | ratchet PASS progress integration |

The user called this "10종", but the explicit list contains 11 files including `progress`. v2.0 treats all 11 as required.

## Safety Guards

Any guard stops autonomous operation, writes `halt-reason.jsonl`, and notifies:

- token percent >= 92%;
- cumulative cycles >= 50;
- same priority fails to PASS three cycles in a row;
- protected file modification attempted;
- all ROADMAP priorities complete;
- OSS install verify fails and rollback fails;
- git push fails five times consecutively;
- runtime code attempts Claude call in Claude-paused mode.

## Commands

New commands:
- `myorch resume`: read `.myorch/sleep-state.json`, pass token guard, then resume autonomous loop.
- `myorch confirm-reset`: accept a low-confidence block reset and restore Claude authority.
- `myorch reject-reset`: reject a low-confidence reset and keep Codex-only mode.
- `myorch oss-review`: list pending OSS merge candidates and their verification evidence.

## CLAUDE.md Critical Rules

Append these critical rules to project `CLAUDE.md` or myorch-owned `.claude/myorch.md`:

- 토큰 효율 최우선. 모드별 정책 엄수.
- 70%+ 모드에서 Claude 호출 금지 (verification-exception 예산 내 제외).
- 5h 블록 리셋 자동 감지, low confidence는 사용자 confirm 대기.
- OSS 설치 전 별도 branch + verify:all 통과 + protected paths 영향 없음 확인.
- 모든 자율 결정 침묵 금지. 10종 jsonl에 기록.

## Verification Scenarios

Add scenarios 13-18:

- 13: 70% token mode switches to Codex-only.
- 14: 5h block reset restores Claude authority.
- 15: reasoning level selection across three token modes.
- 16: one autonomous `/goal` cycle e2e.
- 17: OSS exploration simulation with mocked candidate, sandbox install, verify, pending merge or rollback.
- 18: safety guard halt at forced infinite loop / 50 cycles.

## Open Boundaries

- `claude -p` PostToolUse hook behavior remains verified only in explicit runtime checks.
- `ccusage blocks --json` active id support must be detected at runtime.
- Codex reasoning effort support is discovered via CLI help and cached.
- GitHub push auth is verified with `gh auth status` during implementation.
- External web search availability in Codex runtime may require fallback to CLI/browser research adapters.
