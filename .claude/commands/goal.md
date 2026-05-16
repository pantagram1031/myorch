---
description: Create or refine spec.md, update assumptions.md, and start the first verifier-gated ratchet task
argument-hint: "<task>"
allowed-tools: Bash(node *), Bash(npm *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /goal

!`node dist/src/cli.js route planning`
!`node dist/src/cli.js execute-routed implementation`

If the previous task is complete, recommend `/clear` or `/compact <focus>` before starting fresh context.

Create or refine `spec.md`, update `assumptions.md`, create a ratcheted `plan.md`, then start the first unchecked verifier-gated task.
Requested task: $ARGUMENTS

Use:
```bash
node dist/src/cli.js route planning
node dist/src/cli.js status
node dist/src/cli.js handoff "Implement the current verifier-gated task when routing selects codex."
```

Never mark completion without `node dist/src/cli.js next` returning PASS and advancing the ratchet.
Do not edit `plan.md` checkboxes directly. The PreToolUse hook blocks manual checkbox edits; only `verify-and-advance` may mark PASS.
