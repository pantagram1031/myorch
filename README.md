# myorch

<!-- TODO: demo gif here -->

A usage-aware multi-AI orchestrator: route between Claude Code and Codex CLI based on real-time token usage, with mechanical ratchet enforcement.

myorch is for developers who already use Claude Code and Codex CLI and want a small project-local scaffold that keeps long agentic work moving without relying on "looks done" prose. It routes planning/evaluation toward Claude, implementation/metareview toward Codex, watches `ccusage`, and advances work only when a verifier passes.

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

## Quick Start

```powershell
git clone https://github.com/pantagram1031/myorch.git
cd myorch
npm install
npm run build
npm run verify:all
```

Optional tools for full runtime behavior:

```powershell
claude --version
codex --version
ccusage --json
```

Open the folder in Claude Code, then run:

```text
/goal add a simple function
```

Expected behavior: myorch creates or updates `spec.md` and `plan.md`, routes work, runs verifier hooks after tool use, and only marks progress after PASS.

## Docs
- [Install](docs/INSTALL.md)
- [Tutorial](docs/TUTORIAL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Limits](docs/LIMITS.md)
- [한국어 README](README.ko.md)

## License And Credits

MIT. Built around Claude Code project commands/hooks, Codex CLI, `ccusage`, and the Superpowers development workflow. This project is independent and not affiliated with Anthropic, OpenAI, or the `ccusage` maintainers.

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
