# Usage-Aware Multiagent Orchestrator Spec

## Goal
Build a Windows-native Claude Code project scaffold that accepts `/goal <task>`, advances work only through mechanical verifier PASS results, and routes implementation/metareview work between Claude Code and Codex CLI using live usage data.

## Core Decisions
- Runtime: Node.js and TypeScript.
- Host: Windows native with Git Bash as the default hook shell and PowerShell fallback.
- Global state: `%USERPROFILE%\.claude`, `%USERPROFILE%\.codex`, shell profiles, and system PATH are read-only after the required backup command.
- Codex v1: real Codex CLI subprocess invocation is included with timeout, logging, and manual fallback.
- Dogfood target: a small internal slice of this system.

## Ratchet Pattern
`plan.md` is the source of truth. Work items are markdown checkboxes. A single unchecked item may carry `← current`. Each item includes a verifier command. LLM output cannot mark completion. The ratchet advances only when the verifier returns PASS. PASS is monotonic: checked tasks are never unchecked by the engine.

## Routing
The router reads task kind, recent verifier result counts, manual override, and `ccusage --json` output. Default routing is:
- planning: Claude
- evaluation: Claude
- implementation: Codex
- metareview: Codex

If Claude or Codex usage is at or above 80%, route to the other model unless a valid manual override is active. Missing or malformed ccusage data falls back to defaults and records a warning.

## Planner/Evaluator Isolation
Planner output, evaluator prompts, verifier results, and metareview records are stored as separate artifacts under `.myorch/memory/`. Evaluator prompts receive implementation evidence and verifier output, not the planner's hidden assumptions.

## Claude Code Integration
Project-local `.claude/commands/*.md`, hooks, and rules provide `/goal`, `/next`, `/status`, `/switch`, `/review`, `/pause`, and `/resume`. The project `CLAUDE.md` contains permanent rules and a compaction policy and stays under 120 lines.

## Verification Requirements
The mechanical verifier must check TypeScript tests/build, markdown frontmatter, JSON schema files, Bash hook syntax with `bash -n`, and PowerShell syntax with `[ScriptBlock]::Create`. Claude-specific behavior is dogfooded with `claude -p "scenario" --output-format json` when available; otherwise it is listed in `assumptions.md` and `TESTING.md`.

## Status Formatting
`src/status.ts` exposes `formatProgress(planContent: string): string` which returns a compact string `[N/T done] Current: <title>` for use in statusline output and CLI summaries. This complements `summarizePlanStatus` which returns a structured object.
