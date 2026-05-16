---
description: Inspect or advance verifier-gated ratchet progress
argument-hint: "[status|next]"
allowed-tools: Bash(node *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /ratchet

!`node dist/src/cli.js status`
!`node dist/src/cli.js verify-and-advance`

Use the mechanical ratchet. Do not edit checkboxes manually.

```bash
node dist/src/cli.js status
node dist/src/cli.js next
```
