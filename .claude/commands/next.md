---
description: Run the current task verifier and advance one ratchet item on PASS
allowed-tools: Bash(myorch *)
---
Refer to CLAUDE.md for build/test/style/workflow rules. Do not deviate.
# /next

!`myorch verify-and-advance`

Run the current task verifier and advance exactly one ratchet item only if the verifier passes.

```bash
myorch next
```
