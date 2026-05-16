# Limits

## Compact Triggering

Claude Code hooks cannot directly call slash commands such as `/compact` or `/clear`. myorch does not trigger compaction. It survives compaction with `PreCompact`, `PostCompact`, and `SessionStart(matcher:"compact")`.

## Auto-Compact Instructions

Manual `/compact <focus>` can use project `CLAUDE.md` and the user's focus hint. Auto-compact may not pass custom instructions the same way. Treat auto-compact behavior as a runtime boundary and keep handover files concise.

## Interactive Hook Verification

`claude -p` can verify slash command recognition and many runtime behaviors, but it may not exercise every interactive hook path. Scenario 8 simulates compact hook commands directly; real interactive dogfood is still valuable.

## Windows Native Assumption

myorch targets Windows native with PowerShell and Git Bash. WSL, macOS, and Linux may work with small adjustments, but are not the primary tested path.

## ccusage Semantics

Real `ccusage blocks --json` does not expose a per-model subscription limit. myorch treats active Claude 5-hour block elapsed percent as a practical pressure signal, while keeping synthetic model limit parsing for tests and future richer providers.

## Privacy

`.myorch/memory`, `.myorch/backups`, `.myorch/handover`, local Claude settings, backup directories, logs, and verification reports are ignored because they can include prompts, costs, routing decisions, or transcripts.
