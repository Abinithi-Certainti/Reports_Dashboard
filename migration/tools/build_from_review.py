"""Build mapping.json and the two mock schemas from the lead's schema review data (the DATA object of the
ONroute Schema Review page, saved as JSON). Row counts in that file are NOT copied out.

    python3 tools/build_from_review.py review.json

Writes: mapping.json, mock/source_schema.sql (old SQL Server tables), mock/target_schema.sql (new Postgres tables).
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
review = json.load(open(sys.argv[1]))

# Column that splits a big table into weekly chunks (source column names), and extra fixed values.
CHUNK = {"POS_ORDERS": "Endday", "POS_ORDERDETAILS": "Endday", "POS_ORDERPAYMENTS": "Endday", "POS_ORDERPAIDOUTS": "EndDay",
         "EmployeePaySummaryV2": "PayDate", "WeeklyCogs": "period", "Temp_DLH": "DLH_Date",
         "Sales_2026_UnPivot_New": "TimePeriod_Date", "GM_2026_UnPivot_New": "TimePeriod_Date",
         "DLH_2026_UnPivot_New": "TimePeriod_Date", "Transactions_2026_UnPivot_v2": "TimePeriod_Date"}
ORDER = ["NetSuiteLocation_Mapping", "District_Directors", "date_table", "WeeklyCogsProdNum",  # lookups first
         "Temp_DLH", "Sales_2026_UnPivot_New", "GM_2026_UnPivot_New", "Transactions_2026_UnPivot_v2", "DLH_2026_UnPivot_New",
         "WeeklyCogs", "EmployeePaySummaryV2", "POS_ORDERPAIDOUTS", "POS_ORDERS", "POS_ORDERPAYMENTS", "POS_ORDERDETAILS"]
EXTRA_MAP = {"WeeklyCogs": {"createdate": "created_at"}}
# IDENTITY (auto-numbered) columns, from the production CREATE TABLE scripts (the review does not record them).
IDENTITY = {("NetSuiteLocation_Mapping", "LocationID"), ("WeeklyCogs", "WeeklyCogs_ID"), ("WeeklyCogsProdNum", "WeeklyCogsProdNum_ID")}   # the review suggests keeping the old load time here

tables = {}
for r in review["rows"]:
    s, t = r["s_table"], r["t_table"]
    e = tables.setdefault(s, {"source": s, "target": t, "columns": {}, "src_cols": [], "tgt_cols": []})
    if r["src"]: e["src_cols"].append(r["src"])
    if r["tgt"]: e["tgt_cols"].append(r["tgt"])
    if r["src"] and r["tgt"]: e["columns"][r["src"]["name"]] = r["tgt"]["name"]

mapping = []
for s in ORDER:
    e = tables[s]
    cols = dict(e["columns"]); cols.update(EXTRA_MAP.get(s, {}))
    m = {"source": s, "target": e["target"], "columns": cols, "chunk_column": CHUNK.get(s)}
    yr = re.search(r"_(20\d\d)_UnPivot", s)
    if yr: m["fixed"] = {"budget_year": int(yr.group(1))}
    mapping.append(m)
(HERE / "mapping.json").write_text(json.dumps({"tables": mapping}, indent=2) + "\n")

def q(n): return '"' + n + '"'
src_sql = ["-- Mock of the OLD SQL Server tables (dbo), generated from the schema review. Test only.\n"]
for s in ORDER:
    e = tables[s]
    cols = ",\n".join(f"    [{c['name']}] {c['type']}{' IDENTITY(1,1)' if (s, c['name']) in IDENTITY else ''} {'NULL' if c['null'] else 'NOT NULL'}"
                     for c in e["src_cols"])
    src_sql.append(f"IF OBJECT_ID('dbo.[{s}]') IS NOT NULL DROP TABLE dbo.[{s}];\nCREATE TABLE dbo.[{s}] (\n{cols}\n);\n")
(HERE / "mock" / "source_schema.sql").write_text("\nGO\n".join(src_sql) + "\nGO\n")

tgt_sql = ["-- Mock of the NEW Postgres tables (schema master), generated from the schema review. Test only.",
           "CREATE SCHEMA IF NOT EXISTS master;",
           "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
           "DO $$ BEGIN CREATE TYPE master.order_type_name_enum AS ENUM "
           "('Mobile - Take Out', 'Eat In', 'Drive-Thru', 'Digital Order', 'Cash Drop', 'Take Out', 'Mobile - Drive Thru', 'Paid Out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;"]
PK = {"weekly_cogs_prod_num": "product_num"}
for s in ORDER:
    e = tables[s]; t = e["target"]; parts = []
    for c in e["tgt_cols"]:
        typ = "master.order_type_name_enum" if c["type"] == "USER-DEFINED" else c["type"]
        d = c.get("default")
        if d and "nextval(" in d:
            seq = re.search(r"nextval\('([^']+)'", d).group(1).split(".")[-1]
            tgt_sql.append(f"CREATE SEQUENCE IF NOT EXISTS master.{seq};")
            d = f"nextval('master.{seq}'::regclass)"
        col = f"    {q(c['name'])} {typ}" + ("" if c["null"] else " NOT NULL") + (f" DEFAULT {d}" if d else "")
        parts.append(col)
    pk = PK.get(t) or ("id" if any(c["name"] == "id" for c in e["tgt_cols"]) else None)
    if pk: parts.append(f"    PRIMARY KEY ({q(pk)})")
    tgt_sql.append(f"DROP TABLE IF EXISTS master.{t};\nCREATE TABLE master.{t} (\n" + ",\n".join(parts) + "\n);")
(HERE / "mock" / "target_schema.sql").write_text("\n".join(tgt_sql) + "\n")
print("wrote mapping.json, mock/source_schema.sql, mock/target_schema.sql for", len(mapping), "tables")
