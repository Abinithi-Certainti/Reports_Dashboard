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
python3 migrate.py --env "$ENV" --out run-mock
python3 - <<'PY'
import csv, collections, glob, sys
sys.path.insert(0, "mock"); from make_fake_data import EXPECTED_ERRORS
got = collections.Counter(r["source_table"] for f in glob.glob("run-mock/errors/*.csv") for r in csv.DictReader(open(f)))
bad = {t: (n, got.get(t, 0)) for t, n in EXPECTED_ERRORS.items() if got.get(t, 0) != n}
print("rejected rows match the broken rows planted on purpose" if not bad else f"MISMATCH expected/got: {bad}")
sys.exit(1 if bad else 0)
PY
