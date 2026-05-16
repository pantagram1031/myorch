# Testing Guide

## Preparation
1. Confirm local dependencies:
   ```powershell
   npm install
   npm run build
   npm run verify
   ```
2. Confirm optional tools:
   ```powershell
   claude --version
   codex --version
   ccusage --json
   ```
3. If `ccusage` is unavailable, use the built-in fallback path:
   ```powershell
   npx ccusage --json
   ```
4. Do not modify global Claude/Codex config, shell profiles, or system PATH.

## Scenario 1: `/goal "add a simple function"`
- In Claude Code, run `/goal "add a simple function to this project"`.
- Expected: Claude updates `spec.md` or `plan.md`, routes implementation with `node dist/src/cli.js route implementation`, and ratchet progress remains verifier-gated.
- Debug: run `node dist/src/cli.js status`, then inspect `.myorch/memory/verifier.jsonl`.
- Rollback: revert project-local files with git or restore from your workspace copy; no global config should have changed.

## Scenario 2: Usage threshold fallback
- Mock high Claude usage by testing the router directly:
  ```powershell
  node --import tsx -e "import {routeTask,parseCcusage} from './src/router.ts'; console.log(routeTask({taskKind:'planning',usage:parseCcusage({models:{claude:{used:81,limit:100},codex:{used:1,limit:100}}})}))"
  ```
- Expected: model is `codex` and reason mentions Claude usage at or above 80%.
- Debug: inspect `.myorch/memory/routing.jsonl` after `node dist/src/cli.js route planning`.
- Rollback: delete `.myorch/manual-override` if a previous `/switch` affected routing.

## Scenario 3: Verifier FAIL retry
- Temporarily set the current verifier in `plan.md` to an impossible command such as `node -e "process.exit(1)"`.
- Run:
  ```powershell
  node dist/src/cli.js next
  ```
- Expected: exit code is non-zero, current checkbox stays unchecked, evidence is appended to `.myorch/memory/verifier.jsonl`.
- Debug: run the verifier command directly and inspect stdout/stderr.
- Rollback: restore the verifier command in `plan.md`.

## Scenario 4: Compact hook after ratchet PASS
- Build first:
  ```powershell
  npm run build
  ```
- Run hook syntax and command validation:
  ```powershell
  npm run verify:claude-files
  ```
- Expected: `post-tool-use.sh` passes `bash -n`; after a real PASS it prints a `/compact` hint.
- Debug: run `.claude/hooks/post-tool-use.sh` from Git Bash and inspect the message.
- Rollback: disable the hook by moving `.claude/hooks/post-tool-use.sh` inside the project directory.

## Scenario 5: Codex routed e2e
- Automated by:
  ```powershell
  npm run verify:scenarios
  ```
- Expected: scenario 5 selects Codex, writes `.myorch/memory/handoff.jsonl`, runs verifier, and advances the ratchet checkbox.
- Debug: inspect `.myorch/scenarios/last-run.json` and `.myorch/memory/handoff.jsonl`.
- Rollback: use `/switch claude` or delete `.myorch/manual-override`.

## Scenario 6: Metareview e2e
- Automated by:
  ```powershell
  npm run verify:scenarios
  ```
- Expected: scenario 6 records Claude review and Codex judgment in `.myorch/memory/metareview.jsonl`; both cite verifier evidence.
- Debug: run `node dist/src/cli.js metareview-auto --completed-by codex --evidence "npm test PASS exit=0"` with fake commands if real CLIs are noisy.
- Rollback: remove only project-local `.myorch/memory/metareview.jsonl`.

## Scenario 8: Compact survival e2e
- Automated by:
  ```powershell
  npm run verify:scenarios
  ```
- Expected: `compact-backup` creates `.myorch/backups/precompact-*`, writes `.myorch/handover/handover-*.md`, `compact-record` logs PostCompact, and `compact-restore` prints the latest handover for SessionStart compact injection.
- Debug: run `node dist/src/cli.js compact-backup --trigger manual`, then `node dist/src/cli.js compact-restore`.
- Rollback: delete project-local `.myorch/backups/` and `.myorch/handover/`.

## Scenario 9: Statusline output
- Automated by:
  ```powershell
  npm run verify:scenarios
  ```
- Expected: statusline includes model, cost, 5-hour block remaining, burn rate, context percent, and ratchet progress. At 75%+ it includes a warning marker; at 85%+ it requests a deduped notification.
- Debug: pipe mocked JSON to `node dist/src/cli.js statusline` with `CCUSAGE_MOCK_JSON`.
- Rollback: remove `statusLine` from project-local `.claude/settings.json`.

## Scenario 10: Notification dedup
- Automated by:
  ```powershell
  npm run verify:scenarios
  ```
- Expected: two calls to `scripts/notify.ps1` with the same `-Dedup` key within five minutes create only one delivered notification log record.
- Debug: inspect `.myorch/memory/notifications.jsonl` and `.myorch/cache/notify-dedup.json`.
- Rollback: delete those two project-local files.

## Dogfood Result
Run:
```powershell
node scripts/claude-dogfood.mjs "Return JSON with key ok true for myorch smoke test."
```
Observed on 2026-05-16:
- Exit code: 0.
- Claude Code returned `subtype:"success"`, `is_error:false`, and `terminal_reason:"completed"`.
- The response body was a clarification about "Return" rather than the requested minimal JSON, so this proves non-interactive Claude invocation works locally but does not prove slash-command behavior.
- Follow-up manual Claude Code scenarios above remain required for real `/goal` hook behavior.
