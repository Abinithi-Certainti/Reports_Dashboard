#!/usr/bin/env bash
# End-to-end check of the retail calendar and week/period/year-to-date measures (AG-76), on MADE-UP rows.
# Builds a throwaway local database from the new DB's structure, loads tests/windows_e2e.sql, starts the engine on it,
# and compares the API's answers with totals worked out by hand. Never points at a real database.
# Needs: local PostgreSQL on PGPORT (default 5434), the structure export in NEW_DB_COLUMNS, a built engine jar.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PGPORT:-5434}"
PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
DB=windows_e2e

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
python3 "$HERE/tools/new_db_ddl.py" "${NEW_DB_COLUMNS:-$HERE/extracts/new-db/master_columns.tsv}" | "${PSQL[@]}" -d $DB
"${PSQL[@]}" -d $DB -f "$HERE/tests/windows_e2e.sql"

JAR="$(ls "$HERE"/engine/backend/target/report-engine-*.jar | grep -v original | head -1)"
LOG="$(mktemp)"
PG_HOST=localhost PG_PORT="$PORT" PG_NAME=$DB PG_USERNAME=postgres REPORTS_DIR="$HERE/reports" \
  REPORTS_IMPORT_DIR="$(mktemp -d)" PORT=18080 java -jar "$JAR" >"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 60); do curl -sf localhost:18080/api/reports >/dev/null && break; sleep 1; done
curl -sf localhost:18080/api/reports >/dev/null || { tail -30 "$LOG"; exit 1; }

python3 - <<'PY'
import json, urllib.request
BASE = "http://localhost:18080/api/reports/sales-margin-budget"
def post(body):
    req = urllib.request.Request(BASE + "/query", json.dumps(body).encode(), {"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req))
def get(path):
    return json.load(urllib.request.urlopen(BASE + path))
fails = []
def check(name, got, want):
    ok = abs(float(got) - want) < 0.005 if isinstance(want, (int, float)) and got is not None else got == want
    print(("PASS " if ok else "FAIL ") + f"{name}: got {got}, expected {want}")
    if not ok:
        fails.append(name)

weeks = get("/calendar")
w37 = next(w for w in weeks if w["retail_year"] == 2026 and w["retail_week"] == 37)
check("week 37 dates", (w37["week_start"], w37["week_end"], w37["retail_period"]), ("2026-09-06", "2026-09-12", 9))

m = ["wtd_sales", "ptd_sales", "ytd_sales", "wtd_budget_sales", "wtd_gp", "ptd_gp", "ytd_gp", "wtd_gp_pct", "wtd_bud_pct"]
rows = {r["plaza"]: r for r in post({"dateFrom": "2026-09-06", "dateTo": "2026-09-12", "groupBy": ["plaza"], "measures": m})}
check("plazas (not rolled out left out, names fixed)", sorted(rows), ["Bainsville ON S", "Cambridge North"])
c, b = rows["Cambridge North"], rows["Bainsville ON S"]
check("Cambridge WTD sales (7 x 100, Cash Drop out)", c["wtd_sales"], 700)
check("Cambridge PTD sales (21 days)", c["ptd_sales"], 2100)
check("Cambridge YTD sales (259 days)", c["ytd_sales"], 25900)
check("Cambridge WTD budget (TIM HORTONS DT = TIM HORTONS)", c["wtd_budget_sales"], 630)
check("Cambridge WTD GP (700 - 210)", c["wtd_gp"], 490)
check("Cambridge PTD GP (2100 - 3 x 210)", c["ptd_gp"], 1470)
check("Cambridge YTD GP (25900 - 37 x 210)", c["ytd_gp"], 25900 - 37 * 210)
check("Cambridge WTD GP %", c["wtd_gp_pct"], 0.7)
check("Cambridge WTD Bud % (60 / 90)", c["wtd_bud_pct"], 60 / 90)
check("Bainsville WTD sales (7 x (50 - 1 fee - 2 deposit))", b["wtd_sales"], 329)
check("Bainsville WTD GP (329 - 70)", b["wtd_gp"], 259)
total = post({"dateFrom": "2026-09-06", "dateTo": "2026-09-12", "groupBy": [], "measures": ["wtd_sales", "ytd_gp_pct"]})
check("total row WTD sales", total[0]["wtd_sales"], 1029)
check("total row YTD GP % (from sums, not an average)", total[0]["ytd_gp_pct"], (25900 + 259 * 47 - 37 * 280) / (25900 + 259 * 47))
dd = post({"filters": {"district_director": ["DD B"]}, "dateFrom": "2026-09-06", "dateTo": "2026-09-12", "groupBy": [], "measures": ["ytd_sales"]})
check("filters apply inside every window", dd[0]["ytd_sales"], 259 * 47)
if fails:
    raise SystemExit(f"{len(fails)} check(s) failed")
print("OK: calendar and windows match the hand-worked totals")
PY
