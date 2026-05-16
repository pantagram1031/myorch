---
description: Run Codex metareview with mechanical verifier evidence
argument-hint: "[scope]"
allowed-tools: Bash(node *), Bash(npm *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /metareview

!`node dist/src/cli.js route metareview`
!`node dist/src/cli.js metareview-auto --completed-by codex --evidence "npm run verify PASS"`

Route to metareview, invoke Codex handoff, and cite verifier output.

```bash
node dist/src/cli.js route metareview
node dist/src/cli.js handoff "Metareview $ARGUMENTS and cite verifier evidence from .myorch/memory/verifier.jsonl."
npm run verify
```
