---
description: Run Codex metareview citing verifier evidence; never accept "looks good" as PASS
allowed-tools: Bash(myorch *), Bash(npm *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /review

!`myorch route metareview`
!`myorch metareview-auto --completed-by codex --evidence "npm run verify PASS"`

Run metareview routed through Codex by default. Cite verifier evidence from `.myorch/memory/verifier.jsonl`; do not use "looks good" as a PASS signal.

```bash
myorch route metareview
myorch handoff "Metareview the current changes and cite verifier evidence."
npm run verify
```
