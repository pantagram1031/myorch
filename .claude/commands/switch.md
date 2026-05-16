---
description: Set a manual model override (claude or codex)
argument-hint: "<claude|codex>"
allowed-tools: Bash(node *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /switch

!`node dist/src/cli.js switch "$ARGUMENTS"`

Set a manual model override.

```bash
node dist/src/cli.js switch claude
node dist/src/cli.js switch codex
```
