# Old SQL Server → new Postgres: data migration scripts

Copies the 15 tables the BI reports need from the old SQL Server (`dbo`) into the new Postgres database
(`kios_etl`, schema `master`), following the schema review's source-to-target mapping.

Two ways to run it, with the same rules and checks:

| Path | When | Steps |
|---|---|---|
| **Direct** | the machine running it can reach both databases | `migrate.py` reads SQL Server and writes Postgres |
| **Through files** | the old server can only be read by someone else, or the data is tested locally first | `export.py` (on a machine that reaches SQL Server) → files → `load_raw.py` (local Postgres copy) → `migrate.py` from that copy |

```
 old SQL Server ──export.py──► export/<table>/<month>.tsv.gz + .json receipt ──load_raw.py──► local Postgres "src"
       │                                                                                            │
       └──────────────────────────────── migrate.py (direct) ───────────────► new Postgres ◄── migrate.py (SRC_DRIVER=postgres)
```

## What each script does

**`export.py`** (read only on SQL Server)
1. Splits every big table into **months** (small tables: one piece) and exports several pieces at once (`--workers`).
2. Writes each piece as `export/<table>/<month>.tsv.gz`: Postgres COPY text format (tab between values, `\N` for an
   empty value, so "no value" and "empty text" stay different), gzip-compressed.
3. Writes a **receipt** next to it (`<month>.json`): rows written, and the **row count and amount totals calculated by
   SQL Server itself**, the file's size and sha256 checksum, and the column list. The receipt is written last, so a
   piece without one is unfinished; a re-run skips finished pieces.
4. Pieces are always **whole calendar months**. `--from`/`--to` only choose which months (a date inside a month
   means the whole month), so a month always covers the same days. Nothing after **yesterday** is exported; the month
   that is still running is exported up to yesterday, and a later run sees from its receipt that it is not whole yet,
   exports it again, and `load_raw.py` replaces that month's rows.

**`load_raw.py`** (writes only the local copy)
1. Creates `src."<OldTable>"` with the **old names** and close types (varchar → text, datetime → timestamp ...).
2. Streams every file into Postgres with `COPY`, several files at once. A file is refused if its checksum does not
   match its receipt (damaged in transfer) or if the rows loaded differ from the receipt.
3. Records each loaded file in `src._pieces` in the same transaction as its rows: a re-run never loads a file twice.
4. Compares rows and amount totals of every piece with the receipt, then indexes the date column for `migrate.py`.

**`migrate.py`** (reads the source, writes the target)
1. Reads the **target** table's rules from Postgres: column types, lengths, decimals, NOT NULL, defaults, enum values.
2. Plans the chunks: one **calendar week (Sunday to Saturday)** at a time for big tables, then the rows whose date is
   empty. The weeks never depend on `--from`/`--to` (a date inside a week means the whole week), so every run cuts
   them the same way and a finished week is always recognised. A week that has not ended yet is left for a later
   run. If an older checkpoint holds a week cut differently, the script stops instead of loading those rows twice.
3. Fixes each row to fit: renames, text flags → true/false, text → uuid, enum check, datetime → date or `YYYY-MM-DD`
   text, rounding to the target's decimals, length and NOT NULL checks, `budget_year` from the table name. Each
   column's rule is worked out once, then applied to every value.
4. A row that cannot fit is **not loaded**: it goes to `run/errors/<table>.<week>.csv` with the reason.
5. Good rows are **streamed** into Postgres with `COPY` while they are read (memory stays about 75 MB whatever the
   week size), one transaction per week, several weeks at once (`--workers`). Finished weeks are saved in
   `run/checkpoint.json`, so a stopped run continues where it left off and never loads a week twice. A week that
   fails on a lost connection is rolled back and tried again (2 more times).
6. Checks: source rows = loaded + rejected; rows in the target (on a fresh connection) = loaded; totals of key
   amounts (sales, tax, payments, COGS, hours, budgets) equal old vs new; and, **counted straight from the source**,
   the rows in all finished weeks minus the rejected ones = the rows in the target (catches rows loaded twice or
   missing). Any mismatch ends the run with exit code 1.

## Run it

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pymssql "psycopg[binary]"
cp config.example.env my.env        # fill in; *.env is git-ignored. Never commit or paste real values.
```

Direct:
```bash
python3 migrate.py --env my.env --dry-run      # checks everything, writes nothing: run this first
python3 migrate.py --env my.env --workers 4    # load
python3 migrate.py --env my.env --tables POS_ORDERS --from 2026-09-01 --to 2026-09-30   # part of the data
```

Through files:
```bash
# 1. on the machine that reaches SQL Server (SRC_* = the old SQL Server)
python3 export.py --env export.env --out export --workers 4
python3 export.py --env export.env --out export --extra Sales_2025_UnPivot_New:TimePeriod_Date   # a table not in mapping.json
# 2. move the export folder through company storage only
# 3. locally (SRC_DRIVER=postgres, SRC_* = the local copy; TGT_* = the local target with the QA tables)
python3 load_raw.py --env local.env --dir export --workers 4
python3 migrate.py --env local.env --dry-run
python3 migrate.py --env local.env --workers 4
```
Results: `run/summary.json`, `run/errors/`, `run/warnings/`, and `run/progress.json` (live progress).

**The export folder, `run/errors/` and the local databases hold real data.** Keep them on an encrypted disk, move them
only through company storage, never commit them (`export*/`, `*.tsv.gz` and `run*/` are git-ignored), and delete them
when the test is done.

## Speed (measured on made-up data)

1 million rows of `POS_ORDERDETAILS`, everything on one 4-CPU machine (no network in between):

| Step | Before | Now, 1 worker | Now, 4 workers |
|---|---|---|---|
| `export.py` (SQL Server → files) | – | 46 s (21,700 rows/s) | **14 s (71,500 rows/s)** |
| `load_raw.py` (files → local copy) | – | – | **3 s (about 330,000 rows/s)** |
| `migrate.py` reading SQL Server | 107 s (9,300 rows/s), 384 MB | 61 s (16,500 rows/s) | 24 s (41,800 rows/s) |
| `migrate.py` reading the local copy | – | 36 s (28,000 rows/s) | **16 s (62,700 rows/s)**, 75 MB |

Files: about 55 MB per million rows (gzip). The databases and the workers shared the same 4 CPUs in this test; a
machine with more CPUs, close to the databases, should do better. A real run over the network will be slower.

## Live progress dashboard

`run/progress.json` is rewritten after every week the script loads. It holds only table names, counts, old vs new
totals and rejection reasons (column + problem, never the row values), with no server names or passwords. Upload it
on the shared BI Migration Tracker page (`dashboard.html`, published on claude.ai) and everyone with the link sees the
new numbers at once. The same page holds the Power BI vs new report checks. Upload only `progress.json`: never
`my.env`, `errors/*.csv`, `checkpoint.json` or export files.

## Test on mock databases (no real data, no real servers)

```bash
PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=... ./mock/run_mock_test.sh
```
Starts a throwaway SQL Server in Docker with the old tables (`mock/source_schema.sql`), a local Postgres with the new
tables (`mock/target_schema.sql`), fills the source with 2 weeks of made-up data for 6 stores plus 15 rows broken on
purpose (`mock/make_fake_data.py`), then tests both paths: direct (dry run and load), and export → load_raw →
migrate. Each must reject exactly the broken rows.

The direct path first loads a few days in the middle of a week, then everything, so a run with `--from`/`--to`
followed by a full run is tested every time (it once loaded that week twice).

Last result: both paths loaded all 15 tables, rows balanced, totals equal old vs new, the 15 broken rows rejected
with the right reason, re-runs skipped finished work, and a file with one row missing was refused by `load_raw.py`
(checksum mismatch, nothing loaded).

## Files

| File | What |
|---|---|
| `export.py` | old SQL Server → files with receipts |
| `load_raw.py` | files → local Postgres copy, checked against the receipts |
| `migrate.py` | the migration (from SQL Server, or from the local copy) |
| `mapping.json` | source → target table and column pairs, week column, fixed values; built from the schema review |
| `tools/build_from_review.py` | rebuilds `mapping.json` and the mock schemas from the review's data |
| `mock/` | mock schemas, fake-data generator, one-command test of both paths |

## Decisions still needed before the real run

1. **Rejected rows change totals:** a rejected row is missing from the reports (e.g. a paid-out with an unknown order
   type). Review `run/errors/` and fix the source or the rule before comparing with Power BI.
2. **`pay_date` / `retrieve_date` as text:** written `YYYY-MM-DD` (date only when the time is midnight, else
   `YYYY-MM-DD HH:MM:SS`). The reports read `pay_date::date`, which accepts both.
3. **Budget years:** only the 2026 tables are in the mapping. Add the 2023–2025 tables (`fixed.budget_year` per table)
   once their exact names are known; `export.py --extra` can export them already.
4. **`WeeklyCogs.createdate` → `created_at`:** kept as the load time, as the review suggests.
5. **Run on a target that is empty for these tables** (the script refuses to load a table twice without its checkpoint).
6. **Disk space for the files path:** about 55 MB of files per million rows, plus the local copy and the local target
   (each several times the file size). Check the real row counts first.

Checked already: `order_type_name` has the 8 real values on QA and DEV (incl. `Paid Out`), and `IsRefund`, `HasMods`,
`TaxExemption`, `Deposit`, `UsePennyRounding` are clean true/false on DEV.
