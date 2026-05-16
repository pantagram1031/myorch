#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ ! -f "$ROOT/dist/src/cli.js" ]]; then
  echo "myorch: dist/src/cli.js missing; run npm run build"
  exit 0
fi

if ! output="$(node "$ROOT/dist/src/cli.js" verify-and-advance 2>&1)"; then
  printf '%s\n' "$output" >&2
  powershell -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/notify.ps1" -Title "Verifier FAIL" -Message "Inspect .myorch/memory/verifier.jsonl" -Severity critical -Dedup verifier-fail -Root "$ROOT" >/dev/null 2>&1 || true
  exit 2
fi

printf '%s\n' "$output"
echo "myorch: ratchet PASS; consider /compact with current verifier evidence"
