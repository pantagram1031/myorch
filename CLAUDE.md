# Usage-Aware Orchestrator Rules

This project runs inside Claude Code on Windows native. Never modify global Claude/Codex config, shell profiles, or system PATH.

# Build / Test / Lint
- Full local gate: `npm run verify`.
- Runtime gate: `npm run verify:claude-runtime`.
- Scenario gate: `npm run verify:scenarios`.
- Complete gate: `npm run verify:all`.
- Claude file checks validate command frontmatter, rule frontmatter, hook syntax, statusline syntax, PowerShell notify syntax, and JSON settings.
- Ratchet task verifiers live in `plan.md` as `Verifier: \`...\`` and must be executed mechanically.

# Code Style
- Node/TypeScript modules live in `src/`; tests live in `tests/`.
- Keep modules small: routing, ratchet, handoff, compact, notify, and status each own one concern.
- Use project-local `.claude/`, `.codex/`, and `.myorch/` only.
- Prefer Git Bash hooks; use PowerShell for Windows notifications and fallback syntax checks.
- Memory records are JSONL under `.myorch/memory/`.

# Compaction Policy
- Limit: this section only affects manual `/compact`; auto-compact currently ignores custom instructions in Claude Code.
- The system does not trigger `/compact`; it survives compact by backing up state when `PreCompact` fires.
- Before manual `/compact`, include current ratchet task, verifier evidence, next command, and any focus hint.
- Preserve `plan.md`, `spec.md`, `assumptions.md`, recent `.myorch/memory/*.jsonl`, and latest `.myorch/handover/*.md`.
- After compact, read the injected handover reminder before acting.
- If statusline shows context at 75%+, prepare a focus hint; at 85%+, run `/compact <focus hint>` soon.

# Workflow
- Use Superpowers in order: `brainstorming`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, `requesting-code-review`, `verification-before-completion`.
- Write failing tests before production behavior changes.
- Use `execute-routed` for implementation work so router decisions become real model calls.
- Metareview must cite actual verifier output and reject bare "looks good" responses.

# Critical Rules
- 토큰 효율 최우선. 모드별 정책 엄수.
- 70%+ 모드에서 Claude 호출 금지 (verification-exception 예산 내 제외).
- 5h 블록 리셋 자동 감지, low confidence는 사용자 confirm 대기.
- OSS 설치 전 별도 branch + verify:all 통과 + protected paths 영향 없음 확인.
- 모든 자율 결정 침묵 금지. 10종 jsonl에 기록.
- Do not directly edit `plan.md` checkboxes; only ratchet/verifier commands advance progress.
- LLM prose cannot mark completion. Zero unchecked ratchet tasks plus verifier PASS is the only completion signal.
- A `codex` route must invoke Codex CLI unless the CLI is missing or fails, in which case log fallback.
- A `claude` evaluation must be isolated from planner assumptions and cite evidence.
- Record routing, verifier, handoff, compact, notification, and metareview events under `.myorch/memory/`.
- If hooks or statusline behavior is uncertain, verify against actual Claude Code runtime or record the boundary in `assumptions.md`.
