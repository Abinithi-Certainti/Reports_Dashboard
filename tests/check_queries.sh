#!/usr/bin/env bash
# Builds EMPTY copies of the new tables (structure only, from extracts/new-db/master_columns.tsv)
# and runs a report's queries against them. Proves syntax, column names and types line up.
# It does NOT prove the numbers: there is no data.
# NEW_DB_COLUMNS=<file> uses another structure export (e.g. a newer one kept out of git).
# Usage: bash tests/check_queries.sh reports/tender-report/queries.sql
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
QUERIES="$HERE/${1:?path to queries.sql}"
PORT="${PGPORT:-5434}"
PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS new_db_shape" -c "CREATE DATABASE new_db_shape"
python3 "$HERE/tools/new_db_ddl.py" "${NEW_DB_COLUMNS:-$HERE/extracts/new-db/master_columns.tsv}" | "${PSQL[@]}" -d new_db_shape
"${PSQL[@]}" -d new_db_shape -f "$QUERIES" >/dev/null
echo "OK: every query in $(basename "$(dirname "$QUERIES")")/$(basename "$QUERIES") ran against the new table structure"
