#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT/dist/src/cli.js" ]]; then
  echo "[myorch] run npm run build"
  exit 0
fi

node "$ROOT/dist/src/cli.js" statusline
