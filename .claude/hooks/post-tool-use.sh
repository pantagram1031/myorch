#!/usr/bin/env bash
set -euo pipefail

if ! output="$(myorch verify-and-advance 2>&1)"; then
  printf '%s\n' "$output" >&2
  myorch notify --title "Verifier FAIL" --message "Inspect .myorch/memory/verifier.jsonl" --severity critical --dedup verifier-fail >/dev/null 2>&1 || true
  exit 2
fi

printf '%s\n' "$output"
echo "myorch: ratchet PASS; consider /compact with current verifier evidence"
