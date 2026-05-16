---
description: Explain the current Claude or Codex routing decision
argument-hint: "[planning|evaluation|implementation|metareview]"
allowed-tools: Bash(node *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /routing

!`node dist/src/cli.js route "$ARGUMENTS"`

Show the usage-aware routing decision for the requested task kind.

```bash
node dist/src/cli.js route $ARGUMENTS
```
