# How the Report Engine works

Plain-English guide. For the design and decisions, see `design/report-engine.md`.

## 1. The idea

One website shows every report. A report is **not code** - it is two files:

| File | What it says |
|---|---|
| `report.yaml` | the settings: title, fields, measures, filters, and which visuals to draw |
| `dataset.sql` | one read-only `SELECT` that returns the report's rows from the new PostgreSQL database |

The engine reads those two files and draws the page. Adding report number 2, 10 or 50 means adding two files.

## 2. What happens when someone opens a report

```
Browser                         Engine (Java)                          PostgreSQL (read-only)
-------                         -------------                          ----------------------
1. open #/r/tender-report  -->  load report.yaml (labels, filters,
                                visuals - never the SQL)          
2. draw filters + visuals  <--  
3. user picks Plaza=Market -->  build ONE query:
   (sends names + values,       WITH d AS (<dataset.sql>)
    never SQL)                  SELECT <fields>, <measures> FROM d
                                WHERE plaza = ANY(?)   <- value bound,
                                GROUP BY ...              not pasted in  -->  runs it, read-only
4. numbers appear          <--  rows (+ % to Total worked out)       <--
```

Safety built in:
- The browser can only send **names that exist in the settings file**. Anything else is refused.
- Filter values are **bound as parameters**, never pasted into SQL, so they cannot change the query.
- Every database connection is forced **read-only**, on top of a read-only database user.

## 3. How field mapping works

The old reports use SQL Server names (`POS_ORDERPAYMENTS.PaymentTypeName`); the new database uses PostgreSQL
names (`pos_order_payments.payment_type_name`). Mapping is done in five steps, and only step 4 needs a person.

| Step | What happens | Who |
|---|---|---|
| 1. Extract | 5 read-only DAX queries pull tables, columns, formulas, links and source SQL out of the old report | person runs, 10 min |
| 2. Auto-match | each old name is converted by rule: split the words, lower-case, join with `_` (`PaymentTypeName` -> `payment_type_name`) | automatic |
| 3. Check it exists | every converted name is looked up in the new database structure (`extracts/new-db/master_columns.tsv`) | automatic |
| 4. Review leftovers | anything the rule cannot prove is marked **Review** and waits for a person - never guessed (Tender Report: 1 of 19, `CTLOCATION` -> `ct_location`) | person |
| 5. Go live | the report's `dataset.sql` uses only confirmed new names; a test runs it against the new table structure | automatic |

Everything is stored in the catalog database (`catalog.table_map`, `catalog.column_map`) and shown in the
**Mapping Studio** page. Most tables are shared between reports, so each report after the first needs fewer new
mappings.

## 4. Adding a report without touching the code

Open **Import report**, drop `report.yaml` and `dataset.sql`, press **Check it**. The engine runs four checks:

1. The settings file is valid, and every visual uses fields that exist.
2. The SQL is a single `SELECT` and contains no statement that writes.
3. The report id is free (a built-in report cannot be overwritten by an upload).
4. **Dry run**: every field and measure is tried on the database with `LIMIT 0` - read-only, no rows read.

Only if all four pass can you press **Publish**. The report is live at once - no code change, no redeploy - and is
saved in the import folder (`REPORTS_IMPORT_DIR`) so it survives a restart.

**Before anyone else uses this:** import must be limited to admins (there is no login yet).

## 5. What a report can contain today

| Visual | Settings | Example |
|---|---|---|
| `kpi` | number cards with animated value, daily trend, change vs the previous period, `good_direction: up/down` | Total tender amount |
| `line` | one measure over the date field | Daily tender amount |
| `table` | grouped rows, total row, optional calculation modes | Summary by payment type |
| `bar` | one measure by one field | Tender amount by payment type |
| `matrix` | rows by one or more fields, one column per value of another (for example per day), heat shading | Detail by store and day |

Filters: `multi_select` for any field, `date_range` for the date field.

## 6. Look and feel

- Three themes - **Light**, **Midnight**, **Neon** - switched in the top bar and remembered per browser.
- Sound effects for clicks, filters, theme changes and publishing; switch them off with the speaker button.
  Sounds are generated in the browser (no sound files) and never play until the user has clicked.
- Animations respect the operating system's "reduce motion" setting.
