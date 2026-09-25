#!/usr/bin/env bash
# Every report's dataset.sql must pass the engine's read-only rule: one statement, so no ';' anywhere - comments
# included (the rule does not parse comments). Catches the mistake before a report silently fails to load.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
for f in "$HERE"/reports/*/dataset.sql "$HERE"/demo/import-example/*/dataset.sql; do
  if grep -n ';' "$f" >/dev/null; then
    echo "FAIL: ${f#$HERE/} contains ';' (line $(grep -n ';' "$f" | cut -d: -f1 | paste -sd, -))"; fail=1
  fi
done
[ "$fail" = 0 ] && echo "OK: no dataset.sql contains ';'"
exit "$fail"
