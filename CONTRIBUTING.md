# Contributing

Issues and pull requests are welcome.

## Development

```powershell
npm install
npm run build
npm run verify:all
```

Before opening a PR:
- keep changes project-local;
- do not commit `.myorch/`, backups, logs, `dist/`, or `node_modules/`;
- run `npm run verify:all`;
- include verifier evidence when changing hooks, slash commands, routing, ratchet behavior, or Codex handoff.

## Code Style

See `CLAUDE.md`. Keep TypeScript modules focused and keep Claude Code integration files mechanically verifiable.

## Hook And Verifier Discipline

Do not validate Claude Code integrations only against assumptions invented by this repository. Prefer real runtime checks such as `claude -p`, hook syntax checks, and scenario automation. If a behavior cannot be fully verified non-interactively, document the boundary in `docs/LIMITS.md`.
