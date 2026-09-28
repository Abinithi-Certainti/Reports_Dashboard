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
# ---- Sales Report 1: last year (PY), YOY, labour, weekday and week ending ----
SR = "http://localhost:18080/api/reports/sales-report-1"
def post1(body):
    req = urllib.request.Request(SR + "/query", json.dumps(body).encode(), {"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req))
june = {"dateFrom": "2026-06-01", "dateTo": "2026-06-16"}
t = post1({**june, "groupBy": [], "measures": ["sales", "sales_py", "sales_yoy", "sales_yoy_pct", "labour", "labour_py", "splh", "splh_py", "splh_yoy"]})[0]
check("SR1 sales (16 x 100 + 16 x 47)", t["sales"], 2352)
check("SR1 sales PY (the same retail days in 2025: 16 x 80)", t["sales_py"], 1280)
check("SR1 sales YOY $", t["sales_yoy"], 1072)
check("SR1 sales YOY %", t["sales_yoy_pct"], 1072 / 1280)
check("SR1 labour (16 x 10 crew + 16 x 2 temp, manager and HR left out)", t["labour"], 192)
check("SR1 labour PY", t["labour_py"], 128)
check("SR1 SPLH", t["splh"], 2352 / 192)
check("SR1 SPLH PY", t["splh_py"], 1280 / 128)
check("SR1 SPLH YOY $", t["splh_yoy"], 2352 / 192 - 10)
day = {(str(r["day"]), r["plaza"]): r for r in post1({**june, "groupBy": ["day", "plaza"], "measures": ["sales", "sales_py"]})}
c1 = day[("2026-06-01", "Cambridge North")]
check("SR1 PY lines up on this year's day (Mon 2026-06-01 <- Mon 2025-06-02)", (c1["sales"], c1["sales_py"]), (100, 80))
b1 = day[("2026-06-01", "Bainsville ON S")]
check("SR1 no sales last year gives an empty PY, not 0", (b1["sales"], b1["sales_py"]), (47, None))
wd = {r["weekday"]: r for r in post1({**june, "groupBy": ["weekday"], "measures": ["sales", "sales_py"]})}
check("SR1 Monday (3 Mondays)", (wd["Monday"]["sales"], wd["Monday"]["sales_py"]), (441, 240))
we = {str(r["week_end"]): r for r in post1({**june, "groupBy": ["week_end"], "measures": ["sales", "sales_py"]})}
check("SR1 week ending 2026-06-06 (6 days) with its PY week", (we["2026-06-06"]["sales"], we["2026-06-06"]["sales_py"]), (882, 480))
br = {r["brand"]: r for r in post1({**june, "groupBy": ["plaza", "brand"], "measures": ["sales"]})}
check("SR1 brands kept as sold (TIM HORTONS DT not merged)", sorted(br), ["MARKET", "TIM HORTONS DT"])
if fails:
    raise SystemExit(f"{len(fails)} check(s) failed")
print("OK: calendar and windows match the hand-worked totals")
PY
