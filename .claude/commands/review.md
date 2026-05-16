---
description: Run Codex metareview citing verifier evidence; never accept "looks good" as PASS
allowed-tools: Bash(node *), Bash(npm *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /review

!`node dist/src/cli.js route metareview`
!`node dist/src/cli.js metareview-auto --completed-by codex --evidence "npm run verify PASS"`

Run metareview routed through Codex by default. Cite verifier evidence from `.myorch/memory/verifier.jsonl`; do not use "looks good" as a PASS signal.

```bash
node dist/src/cli.js route metareview
node dist/src/cli.js handoff "Metareview the current changes and cite verifier evidence."
npm run verify
```
