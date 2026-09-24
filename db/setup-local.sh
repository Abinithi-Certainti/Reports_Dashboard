#!/usr/bin/env bash
# Rebuilds the local report catalog database from the files in this repo.
# The database itself is throwaway; the SQL files are the permanent record.
# Usage: bash db/setup-local.sh        (needs PostgreSQL 16 binaries on PATH or in /usr/lib/postgresql/16/bin)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="${PGDATA_DIR:-/tmp/report-catalog-pg}"
PORT="${PGPORT:-5434}"
DB="report_catalog"

if [ ! -d "$DATA" ]; then
  "$PGBIN/initdb" -D "$DATA" -A trust -U postgres >/dev/null
fi
if ! "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/server.log" start >/dev/null
  sleep 2
fi

PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"

for f in "$HERE"/migrations/[0-9]*_*.sql; do
  case "$f" in *.rollback.sql) continue ;; esac
  "${PSQL[@]}" -d "$DB" -f "$f"
done
for f in "$HERE"/seeds/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo "Catalog ready: psql -h /tmp -p $PORT -U postgres -d $DB"
