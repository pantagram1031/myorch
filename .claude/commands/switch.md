---
description: Set a manual model override (claude or codex)
argument-hint: "<claude|codex>"
allowed-tools: Bash(myorch *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /switch

!`myorch switch "$ARGUMENTS"`

Set a manual model override.

```bash
myorch switch claude
myorch switch codex
```
