#!/usr/bin/env bash
# One-command test on mock databases only: a mock SQL Server (Docker) as the old source, a local Postgres as the target.
# Needs: docker, a local Postgres you can create databases in (PG* settings), python3 with pymssql + psycopg.
set -euo pipefail
cd "$(dirname "$0")/.."
PW="Mock$(openssl rand -hex 8)!a"                     # throwaway password for the throwaway container
docker rm -f mock-mssql >/dev/null 2>&1 || true
docker run -d --name mock-mssql -e ACCEPT_EULA=Y -e "MSSQL_SA_PASSWORD=$PW" -p 14330:1433 mcr.microsoft.com/mssql/server:2022-latest >/dev/null
for i in $(seq 1 60); do python3 -c "import pymssql; pymssql.connect(server='127.0.0.1', port=14330, user='sa', password='$PW').close()" 2>/dev/null && break; sleep 2; done
python3 - <<PY
import pymssql
c = pymssql.connect(server="127.0.0.1", port=14330, user="sa", password="$PW", autocommit=True)
c.cursor().execute("IF DB_ID('OldProdMock') IS NULL CREATE DATABASE OldProdMock"); c.close()
c = pymssql.connect(server="127.0.0.1", port=14330, user="sa", password="$PW", database="OldProdMock", autocommit=True)
for part in open("mock/source_schema.sql").read().split("\nGO\n"):
    if part.strip(): c.cursor().execute(part)
PY
psql -q -c 'DROP DATABASE IF EXISTS qa_mock WITH (FORCE)' -c 'CREATE DATABASE qa_mock'
psql -q -v ON_ERROR_STOP=1 -d qa_mock -f mock/target_schema.sql
ENV=$(mktemp); trap 'rm -f "$ENV"; docker rm -f mock-mssql >/dev/null' EXIT
cat > "$ENV" <<E
SRC_HOST=127.0.0.1
SRC_PORT=14330
SRC_DATABASE=OldProdMock
SRC_USER=sa
SRC_PASSWORD=$PW
TGT_HOST=${PGHOST:-127.0.0.1}
TGT_PORT=${PGPORT:-5432}
TGT_DATABASE=qa_mock
TGT_USER=${PGUSER:-postgres}
TGT_PASSWORD=${PGPASSWORD:-}
E
set -a; . "$ENV"; set +a
python3 mock/make_fake_data.py
rm -rf run-mock && python3 migrate.py --env "$ENV" --dry-run --out run-mock-dry
# A part first, with dates in the middle of a week (the case that once loaded rows twice), then everything: the
# second run must skip that week, and the check against the source fails the test if any row is in twice.
python3 migrate.py --env "$ENV" --out run-mock --from 2026-09-08 --to 2026-09-10
python3 migrate.py --env "$ENV" --out run-mock
check_rejects() {
python3 - "$1" <<'PY'
import csv, collections, glob, sys
sys.path.insert(0, "mock"); from make_fake_data import EXPECTED_ERRORS
got = collections.Counter(r["source_table"] for f in glob.glob(sys.argv[1] + "/errors/*.csv") for r in csv.DictReader(open(f)))
bad = {t: (n, got.get(t, 0)) for t, n in EXPECTED_ERRORS.items() if got.get(t, 0) != n}
print(sys.argv[1] + ": rejected rows match the broken rows planted on purpose" if not bad else f"MISMATCH expected/got: {bad}")
sys.exit(1 if bad else 0)
PY
}
check_rejects run-mock

# Second path: export to files -> load_raw into a local Postgres copy -> migrate from that copy. Same results expected.
psql -q -c 'DROP DATABASE IF EXISTS raw_mock WITH (FORCE)' -c 'CREATE DATABASE raw_mock' \
        -c 'DROP DATABASE IF EXISTS qa_mock2 WITH (FORCE)' -c 'CREATE DATABASE qa_mock2'
psql -q -v ON_ERROR_STOP=1 -d qa_mock2 -f mock/target_schema.sql
LOCAL=$(mktemp); trap 'rm -f "$ENV" "$LOCAL"; docker rm -f mock-mssql >/dev/null' EXIT
cat > "$LOCAL" <<E
SRC_DRIVER=postgres
SRC_HOST=${PGHOST:-127.0.0.1}
SRC_PORT=${PGPORT:-5432}
SRC_DATABASE=raw_mock
SRC_USER=${PGUSER:-postgres}
SRC_PASSWORD=${PGPASSWORD:-}
TGT_HOST=${PGHOST:-127.0.0.1}
TGT_PORT=${PGPORT:-5432}
TGT_DATABASE=qa_mock2
TGT_USER=${PGUSER:-postgres}
TGT_PASSWORD=${PGPASSWORD:-}
E
rm -rf export-mock run-mock-files
python3 export.py --env "$ENV" --out export-mock --to 2026-12-31
python3 load_raw.py --env "$LOCAL" --dir export-mock
python3 migrate.py --env "$LOCAL" --out run-mock-files
check_rejects run-mock-files
