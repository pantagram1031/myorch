---
description: Run Codex metareview with mechanical verifier evidence
argument-hint: "[scope]"
allowed-tools: Bash(myorch *), Bash(npm *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /metareview

!`myorch route metareview`
!`myorch metareview-auto --completed-by codex --evidence "npm run verify PASS"`

Route to metareview, invoke Codex handoff, and cite verifier output.

```bash
myorch route metareview
myorch handoff "Metareview $ARGUMENTS and cite verifier evidence from .myorch/memory/verifier.jsonl."
npm run verify
```
