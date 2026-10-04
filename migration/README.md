# Old SQL Server → new Postgres: data migration script

Copies the 15 tables the BI reports need from the old SQL Server (`dbo`) into the new Postgres database
(`kios_etl`, schema `master`), following the schema review's source-to-target mapping.

## What it does, per table

1. Reads the **target** table's rules from Postgres: column types, lengths, decimals, NOT NULL, defaults, enum values.
2. Reads the **source** one week at a time (big tables), then the rows whose date is empty.
3. Fixes each row to fit: renames, text flags → true/false, text → uuid, enum check, datetime → date or `YYYY-MM-DD`
   text, rounding to the target's decimals, length and NOT NULL checks, `budget_year` from the table name.
4. A row that cannot fit is **not loaded**: it goes to `run/errors/<table>.csv` with the reason. Nothing is cut short.
5. Good rows go in with Postgres `COPY`, one transaction per week. Finished weeks are saved in `run/checkpoint.json`,
   so a stopped run continues where it left off and never loads a week twice.
6. Checks: source rows = loaded + rejected; rows in the target (on a fresh connection) = loaded; totals of key
   amounts (sales, tax, payments, COGS, hours, budgets) equal old vs new.

The source is only read. Lookup tables are copied first, the big POS tables last.

## Run it

```bash
pip install pymssql "psycopg[binary]"
cp config.example.env my.env        # fill in; my.env is git-ignored. Never commit or paste real values.
python3 migrate.py --env my.env --dry-run      # checks everything, writes nothing: run this first
python3 migrate.py --env my.env                # load
python3 migrate.py --env my.env --tables POS_ORDERS --from 2026-09-01 --to 2026-09-30   # part of the data
```
Results: `run/summary.json`, `run/errors/<table>.csv`, `run/warnings.log`, and `run/progress.json` (live progress).

## Live progress dashboard

`run/progress.json` is rewritten after every week the script loads. It holds only table names, counts, old vs new
totals and rejection reasons (column + problem, never the row values), with no server names or passwords. Upload it
on the shared BI Migration Tracker page (`dashboard.html`, published on claude.ai) and everyone with the link sees the
new numbers at once. The same page holds the Power BI vs new report checks. Upload only `progress.json`: never
`my.env`, `errors/*.csv` or `checkpoint.json`.

## Test on mock databases (no real data, no real servers)

```bash
PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=... ./mock/run_mock_test.sh
```
Starts a throwaway SQL Server in Docker with the old tables (`mock/source_schema.sql`), a local Postgres with the new
tables (`mock/target_schema.sql`), fills the source with 2 weeks of made-up data for 6 stores plus 15 rows broken on
purpose (`mock/make_fake_data.py`), runs a dry run and a load, and checks that exactly the broken rows are rejected.

Last result: all 15 tables loaded, rows balanced, totals equal old vs new (0.00 difference), the 15 broken rows
rejected with the right reason. The report engine run on the migrated mock data gave the same Tender, Sales, HST and
budget totals as the same sums calculated directly on the old mock database.

## Files

| File | What |
|---|---|
| `migrate.py` | the migration |
| `mapping.json` | source → target table and column pairs, week column, fixed values; built from the schema review |
| `tools/build_from_review.py` | rebuilds `mapping.json` and the mock schemas from the review's data |
| `mock/` | mock schemas, fake-data generator, one-command test |

## Decisions still needed before the real run

1. **Enum values for `order_type_name`:** the script reads them from the target. Every distinct old `OrderTypeName`
   must be one of them, or that row is rejected. The mock uses a guessed list.
2. **Yes/no text:** accepted as true: `true t yes y 1`; false: `false f no n 0`; empty → NULL. Check the distinct
   old values of `IsRefund`, `HasMods`, `TaxExemption`, `Deposit`, `UsePennyRounding`.
3. **Rejected rows change totals:** a rejected row is missing from the reports (e.g. a paid-out with an unknown order
   type). Review `errors/*.csv` and fix the source or the rule before comparing with Power BI.
4. **`pay_date` / `retrieve_date` as text:** written `YYYY-MM-DD` (date only when the time is midnight, else
   `YYYY-MM-DD HH:MM:SS`). The reports read `pay_date::date`, which accepts both.
5. **Budget years:** only the 2026 tables are in the mapping. Add `Sales_2023..2025_UnPivot_New` and
   `GM_2023..2025_UnPivot_New` if older budgets are needed (`fixed.budget_year` per table).
6. **`WeeklyCogs.createdate` → `created_at`:** kept as the load time, as the review suggests.
7. **Run on a target that is empty for these tables** (the script refuses to load a table twice without its checkpoint).
