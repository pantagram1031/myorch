# myorch

<!-- TODO: demo gif here -->

A usage-aware multi-AI orchestrator: route between Claude Code and Codex CLI based on real-time token usage, with mechanical ratchet enforcement.

myorch is for developers who already use Claude Code and Codex CLI and want a small scaffold they can apply to any project. It routes planning/evaluation toward Claude, implementation/metareview toward Codex, watches `ccusage`, and advances `plan.md` only when a verifier passes.

## Quick Start

```powershell
npm install -g github:pantagram1031/myorch
cd your-project
myorch init
claude
```

Then type:

```text
/goal "your first task"
```

No separate build command is needed. The npm `prepare` script builds myorch during git/global install.

## Core Ideas
- **Ratchet:** `plan.md` checkboxes advance only through verifier PASS.
- **Routing:** task kind plus `ccusage` decides Claude vs Codex; manual `/switch` is available.
- **Metareview:** completed work is reviewed with verifier evidence, not vibes.
- **Compact resilience:** compact hooks back up ratchet state and restore a handover reminder.
- **Statusline:** `ccusage` and ratchet progress stay visible every turn.

Example statusline:

```text
claude | $1.23 | 5h:50m | 6596 tok/min | 42% ctx | [5/7 done] Task 6
```

## Optional Checks

```powershell
claude --version
codex --version
ccusage --json
```

Expected behavior after `/goal`: myorch creates or updates `spec.md` and `plan.md`, routes work, runs verifier hooks after tool use, and only marks progress after PASS.

## Docs
- [Install](docs/INSTALL.md)
- [Tutorial](docs/TUTORIAL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Migration](docs/MIGRATION.md)
- [Limits](docs/LIMITS.md)
- [Korean README](README.ko.md)

## License And Credits

MIT. Built around Claude Code project commands/hooks, Codex CLI, `ccusage`, and the Superpowers development workflow. This project is independent and not affiliated with Anthropic, OpenAI, or the `ccusage` maintainers.

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
