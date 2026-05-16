# Assumptions And Verification Boundaries

## Fixed Defaults
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is disabled by default.
- `ccusage` may be absent globally; the system tries `ccusage --json`, then `npx ccusage --json`.
- Git Bash default path is `C:\Program Files\Git\bin\bash.exe`.
- PowerShell is used for Windows notifications and syntax fallback.
- The first dogfood scenario uses a small internal task, not the entire project.

## Verification Boundaries
- Claude Code slash command behavior cannot be fully proven by Codex alone. The project validates file format mechanically and runs `claude -p` dogfood scenarios when the local CLI supports them.
- BurntToast notification display depends on local Windows notification permissions. The notifier command is documented and syntax-checked; visible notification delivery remains a manual check.
- Codex subprocess behavior depends on the installed Codex CLI. The handoff module tests invocation, timeout, and logging behavior using mocked executables.
- v1.1 correction: `paths:` in `.claude/commands/*.md` was a frontmatter-spec mistake for slash commands. The original intent was path-scoped activation for project rules/skills, so `paths:` belongs in `.claude/rules/*.md` and skill metadata, not command files. Command files now use `description` plus optional `argument-hint`, `allowed-tools`, and `model`.
- v1.2 enforcement correction: slash command markdown is treated as soft guidance unless paired with hooks and forced shell expansion. The project now registers `PreToolUse`, `PostToolUse`, and `UserPromptExpansion` hooks in `.claude/settings.json`; uses `verify-and-advance` for system-only ratchet marking; and uses scenario automation to prove behavior through `claude -p`.
- v1.2 residual assumption: `claude -p` can verify command recognition, hook-triggered behavior, and permission-denial evidence, but an already-open interactive Claude Code UI may require restart/reload before reading changed `.claude/settings.json`.
- v1.3 Codex CLI invocation was verified from local help output as `codex exec [OPTIONS] [PROMPT]`; the orchestrator uses `codex exec --skip-git-repo-check --cd <workspace> <packaged task>`.
- v1.3 retry policy: Codex handoff retries are capped at 2 attempts by default. After that, enforcement logs a fallback route to Claude rather than letting the ratchet advance without verifier evidence.
- v1.3 metareview policy: automated metareview requires verifier evidence in both the first review and the Codex judgment. A bare "looks good" style response is invalid.
- v1.3 scenario scope: the v1.3 scenario runner keeps the earlier Claude slash recognition/runtime checks and uses deterministic CLI setup for scenario 1 so this cycle can focus on real Codex handoff, retry/fallback, and metareview automation.
- v1.3 residual assumption: actual `codex exec` can emit unrelated configured MCP/auth warnings on stderr. The smoke check treats the call as valid only when the subprocess exits 0 and returns the expected response token.
- v1.3.5 compact correction: hooks cannot directly invoke `/compact` or `/clear`. The system now survives compaction with `PreCompact`, `PostCompact`, and `SessionStart(matcher:"compact")` hooks instead of trying to trigger slash commands from hooks.
- v1.3.5 compact verification boundary: scenario 8 simulates hook commands directly because non-interactive `claude -p` may not exercise every interactive compaction path. Actual interactive auto-compact hook firing remains a manual dogfood check.
- v1.3.5 context percent assumption: the statusline prefers Claude Code `context_window.used_percentage`. If absent, it displays `0%` rather than inventing a token estimate; adding transcript-token estimation is deferred until the runtime input proves the field is absent in real sessions.
- v1.3.5 statusline performance assumption: statusline reads real `ccusage blocks --json` through a 5-second cache and a short timeout. If the live call is slow or malformed, the statusline uses cached or empty usage data so it does not block turns.
- v1.3.5 usage routing assumption: real `ccusage blocks --json` has no per-model subscription limit, so the router treats active Claude 5-hour block elapsed percent as the live Claude pressure signal. Synthetic `models.{claude,codex}.used/limit` remains supported for deterministic tests and future richer providers.
- v1.3.5 notification boundary: BurntToast visual delivery depends on Windows notification permissions and module installation. The script always logs/dedups notification attempts and falls back to console/beep.

## Codex To Claude Code Mapping
| Concern | Claude Code side | Codex side |
| --- | --- | --- |
| Planning | `/goal`, planner prompt, `plan.md` | Reads plan and implements routed tasks |
| Evaluation | isolated evaluator prompt, verifier evidence | metareview with verifier output |
| Implementation | hands off when router chooses Codex | Codex subprocess executes scoped prompt |
| Progress | PostToolUse hook invokes ratchet | ratchet module updates `plan.md` |
| Usage | statusline reads ccusage snapshot | router consumes parsed usage |
