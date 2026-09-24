#!/usr/bin/env bash
# Builds EMPTY copies of the new tables (structure only, from extracts/new-db/master_columns.tsv)
# and runs a report's queries against them. Proves syntax, column names and types line up.
# It does NOT prove the numbers: there is no data.
# Usage: bash tests/check_queries.sh reports/tender-report/queries.sql
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
QUERIES="$HERE/${1:?path to queries.sql}"
PORT="${PGPORT:-5434}"
PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS new_db_shape" -c "CREATE DATABASE new_db_shape"
python3 - "$HERE/extracts/new-db/master_columns.tsv" <<'PY' | "${PSQL[@]}" -d new_db_shape
import sys, csv, collections
cols = collections.defaultdict(list)
for r in csv.DictReader(open(sys.argv[1]), delimiter='\t'):
    t = 'text' if r['data_type'] in ('USER-DEFINED', 'ARRAY') else r['data_type']
    cols[r['table_name']].append((int(r['ordinal_position']), r['column_name'], t))
print('CREATE SCHEMA master;')
for tbl, cs in cols.items():
    body = ', '.join(f'"{c}" {t}' for _, c, t in sorted(cs))
    print(f'CREATE TABLE master."{tbl}" ({body});')
PY
"${PSQL[@]}" -d new_db_shape -f "$QUERIES" >/dev/null
echo "OK: every query in $(basename "$(dirname "$QUERIES")")/$(basename "$QUERIES") ran against the new table structure"
