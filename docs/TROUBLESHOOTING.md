# Troubleshooting

## Slash Commands Do Not Appear

Run:

```powershell
npm run verify:claude-files
npm run verify:claude-runtime
```

Claude command files must use `description`, `argument-hint`, `allowed-tools`, and `model` frontmatter. `paths:` belongs in `.claude/rules/`, not `.claude/commands/`.

If an interactive Claude Code window was already open, restart it after changing `.claude/commands` or `.claude/settings.json`.

## Hooks Do Not Fire

Run:

```powershell
npm run build
npm run verify:claude-files
```

Check `.claude/settings.json`. Hooks call built files under `dist/`, so `npm run build` must run first.

## Statusline Does Not Show Usage

Check:

```powershell
ccusage blocks --json
node dist/src/cli.js statusline
```

The statusline uses a short timeout and a 5-second cache. If `ccusage` is slow or unavailable, it falls back to cached or empty usage fields.

## Codex Handoff Does Not Run

Check:

```powershell
codex exec --help
node dist/src/cli.js execute-routed implementation --no-metareview
```

myorch uses `codex exec --skip-git-repo-check --cd <workspace> <prompt>`.

## Verifier Fails But Claude Does Not See Why

`PostToolUse` should write failure evidence to stderr. Verify hook syntax:

```powershell
npm run verify:claude-files
```

Then inspect `.myorch/memory/verifier.jsonl`.

## Notifications Do Not Appear

Install BurntToast or rely on fallback logging:

```powershell
Install-Module BurntToast -Scope CurrentUser
```

Notification attempts are logged under `.myorch/memory/notifications.jsonl`, which is gitignored.
