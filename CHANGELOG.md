# Changelog

## v1.3.5

Added compact resilience with `PreCompact`, `PostCompact`, and `SessionStart(matcher:"compact")` hooks; added permanent project rules in `CLAUDE.md`; added statusline output with `ccusage blocks`; added PowerShell/BurntToast notifications with dedup.

## v1.3

Connected routing decisions to real Codex CLI execution. When the router chooses Codex, myorch calls `codex exec`, feeds results into the verifier ratchet, retries on failure, and records automated metareview evidence.

## v1.2

Moved from soft slash-command instructions to enforcement. Registered real PostToolUse hooks, blocked direct ratchet checkbox edits through PreToolUse, and added automated scenarios for routing, verifier failure, compact intent, and permission denial behavior.

## v1.1

Fixed Claude Code slash-command frontmatter validation. Command files now use `description` instead of the mistaken `paths:` field, and `verify:claude-runtime` checks command recognition through Claude Code itself.

## v1.0

Initial scaffold with slash commands, ratchet/router skeleton, TypeScript modules, project-local Claude files, and verifier-oriented planning.
