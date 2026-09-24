#!/usr/bin/env bash
# Creates the local demo database "tender_demo": the new DB's table structure plus SAMPLE data.
# Needs a local PostgreSQL 16 (db/setup-local.sh starts one on port 5434).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PGPORT:-5434}"
PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS tender_demo" -c "CREATE DATABASE tender_demo"
python3 "$HERE/tools/new_db_ddl.py" "$HERE/extracts/new-db/master_columns.tsv" | "${PSQL[@]}" -d tender_demo
"${PSQL[@]}" -d tender_demo -f "$HERE/demo/sample_data.sql" >/dev/null
"${PSQL[@]}" -d tender_demo -c "SELECT 'payments' AS t, count(*) FROM master.pos_order_payments
                                UNION ALL SELECT 'paid-outs', count(*) FROM master.pos_order_paid_outs"
echo "Demo database ready: tender_demo on port $PORT (SAMPLE DATA)"
