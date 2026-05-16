---
name: compact-policy
description: Preserve ratchet context across Claude Code compaction.
---

# Compact Policy

Before compaction, summarize the current task, verifier command, latest evidence, routing decision, and next command. After a ratchet PASS, prompt for `/compact` with that focus.
