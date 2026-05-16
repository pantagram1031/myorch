# Tutorial

## 1. First Goal

Open the repository folder in Claude Code:

```text
/goal add a simple function
```

myorch should:
- create or refresh `spec.md`;
- create a verifier-gated `plan.md`;
- log routing under `.myorch/memory/`;
- keep `plan.md` advancement verifier-gated.

## 2. Watch The Ratchet

Run:

```text
/status
```

or from a shell:

```powershell
myorch status
```

Unchecked tasks remain open until their verifier passes. Direct checkbox edits are blocked by the plan guard.

## 3. Routing And Handoff

Implementation work defaults to Codex:

```powershell
myorch execute-routed implementation
```

The command packages the current task, calls `codex exec`, then runs the same verifier path used by hooks.

## 4. When Verifiers Fail

If a verifier fails, myorch records evidence in `.myorch/memory/verifier.jsonl` and returns failure evidence to Claude Code through hook stderr. Fix the issue, then let the verifier run again.

## 5. Compact Survival

myorch does not trigger `/compact` from hooks. Instead:
- `PreCompact` backs up `plan.md` and memory JSONL files;
- `PostCompact` records compaction;
- `SessionStart(matcher:"compact")` prints the latest handover summary.

When the statusline shows high context pressure, manually run:

```text
/compact focus on the current ratchet task and verifier evidence
```

## 6. One-Week Dogfood Loop

Use `/goal` for small real tasks. Check:
- `.myorch/memory/routing.jsonl` for routing decisions;
- `.myorch/memory/handoff.jsonl` for Codex subprocess evidence;
- `.myorch/memory/metareview.jsonl` for review evidence;
- `.myorch/handover/` after compact events.

All these files are ignored by git because they may contain private work traces.
