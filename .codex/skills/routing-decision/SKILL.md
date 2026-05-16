---
name: routing-decision
description: Decide Claude vs Codex routing using task kind, manual override, and ccusage data.
---

# Routing Decision

Run `node dist/src/cli.js route <planning|evaluation|implementation|metareview>`. Prefer defaults unless usage is at or above 80%, recent verifier failures require Claude evaluation, or `/switch` has set a manual override.
