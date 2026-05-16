# Usage-Aware Multiagent Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` and `superpowers:test-driven-development`. Steps use checkbox (`- [ ]`) syntax for tracking. Advancement is mechanical: verifier PASS only.

**Goal:** Build the Windows-native Claude Code orchestrator scaffold with usage-aware routing, ratchet progress, Codex subprocess handoff, and mechanical verification.

**Architecture:** TypeScript modules own pure behavior; project-local Claude files call `node dist/src/cli.js`. Verifier evidence and routing history live under `.myorch/memory/`.

**Tech Stack:** Node.js, TypeScript, node:test, Git Bash, PowerShell, Claude Code, Codex CLI.

---

- [x] **Task 1: Project skeleton and router**
  - Files: `package.json`, `tsconfig.json`, `src/router.ts`, `src/ccusage.ts`, `src/types.ts`, `tests/router.test.ts`
  - Code intent: route planning/evaluation to Claude and implementation/metareview to Codex, with 80% usage fallback and manual override.
  - Verifier: `npm test -- --test-name-pattern=router`

- [x] **Task 2: Ratchet engine**
  - Files: `src/ratchet.ts`, `tests/ratchet.test.ts`
  - Code intent: parse checkbox tasks, identify current task, advance exactly one task on PASS, and refuse advancement on FAIL.
  - Verifier: `npm test -- --test-name-pattern=ratchet`

- [x] **Task 3: Verifier runner and format checks**
  - Files: `src/verifier.ts`, `src/frontmatter.ts`, `tests/verifier.test.ts`
  - Code intent: run commands with captured evidence and validate frontmatter, JSON shape, Bash syntax, and PowerShell syntax.
  - Verifier: `npm test -- --test-name-pattern=verifier`

- [x] **Task 4: Codex handoff and memory**
  - Files: `src/handoff.ts`, `src/memory.ts`, `tests/handoff.test.ts`, `tests/memory.test.ts`
  - Code intent: invoke Codex subprocess with timeout/logging and append verifier/routing/token memory records.
  - Verifier: `npm test -- --test-name-pattern="handoff|memory"`

- [x] **Task 5: CLI and Claude Code integration**
  - Files: `src/cli.ts`, `.claude/commands/*.md`, `.claude/hooks/*.sh`, `.claude/rules/*.md`, `CLAUDE.md`, `.gitignore`
  - Code intent: expose `/goal`, `/next`, `/status`, `/switch`, `/review`, `/pause`, `/resume` behavior through project-local command files and CLI subcommands.
  - Verifier: `npm run verify:claude-files`

- [x] **Task 6: Custom skills and final testing guide**
  - Files: `.codex/skills/*/SKILL.md`, `TESTING.md`, `scripts/claude-dogfood.mjs`
  - Code intent: document custom skills and end-to-end Claude Code test scenarios with dogfood results when available.
  - Verifier: `npm run verify`

- [x] **Task 7: Add formatProgress utility to status module**
  - Files: `src/status.ts`, `tests/status.test.ts`
  - Code intent: add `formatProgress(planContent: string): string` returning `[N/T done] Current: <title>` for statusline and CLI summary use.
  - Verifier: `npm test -- --test-name-pattern=status`
