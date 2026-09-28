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
names (`pos_order_payments.payment_type_name`). Picture version: `docs/mapping-diagram.html`.

| Step | What happens | Who |
|---|---|---|
| 1. Extract | 5 read-only DAX queries pull tables, fields, formulas, links and source SQL out of the old report | person, ~10 min |
| 2. Save in catalog | stored in the catalog database | automatic |
| 3. Confirm tables once | old table -> new table. Old table names often break the naming rule (`POS_ORDERPAYMENTS` is all capitals), so a person confirms each table **once**; tables are shared, so later reports reuse it | person, once per table |
| 4. Match fields by rule | `tools/auto_map.py` tries the rules below and checks every result exists in the new database | automatic |
| 5. Review leftovers | only fields marked Review or Missing reach a person - nothing is guessed | person |
| 6. Go live | the report's SQL uses only confirmed names; `tests/check_queries.sh` runs it against the new tables | automatic |

Matching rules, tried in order - the first that finds a real field wins:

| Rule | Example | Result |
|---|---|---|
| exact (lower-cased) | `Plaza` -> `plaza` | Auto |
| snake case | `PaymentTypeName` -> `payment_type_name`, `HostLocationID` -> `host_location_id` | Auto |
| ignore underscores | `CTLOCATION` -> `ct_location` | Review |
| nothing found | - | Missing |

Tender Report result: with the 4 tables confirmed, **18 of 19 fields Auto, 1 Review, 0 guessed** - and the tool's
answer agrees with the hand-made mapping on all 19. Without confirmed tables it marks 15 of 19 Review, which is why
step 3 exists.

```bash
python3 tools/auto_map.py extracts/tender-report/old_fields.tsv extracts/new-db/master_columns.tsv \
        --tables extracts/tender-report/confirmed_tables.tsv
```

Correction to an earlier status: before `tools/auto_map.py` existed, the Tender Report's 19 fields were matched by
applying the rule by hand; only the "exists in the new database" check was automatic.

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
| `kpi` | number cards with animated value, daily trend, change vs the previous period, `good_direction: up/down`, optional `icon` (total, cash, card, paidout, count, store, trend) | Total tender amount |
| `line` | one measure over the date field | Daily tender amount |
| `table` | grouped rows, total row, optional calculation modes | Summary by payment type |
| `bar` | one measure by one field | Tender amount by payment type |
| `matrix` | rows by one or more fields, one column per value of another (for example per day), heat shading | Detail by store and day |
| `donut` | share of one measure by one field, as a ring; total in the centre, slice details on hover | Share by brand |
| `leaderboard` | groups ranked biggest first, top `limit` (default 8), with a second value under each name | Top stores |

Layout: visuals appear in the order the settings file lists them, on a 12-column grid. `span: 1-12` sets a visual's
width (defaults: kpi, line, matrix and leaderboard full width; table 5; bar 7; donut 4). On phones every visual is
full width. The engine refuses an unknown visual type, a `span` outside 1-12, a `limit` outside 1-50, or an unknown
KPI icon.

Filters: `multi_select` for any field, `date_range` for the date field.

## 6. Look and feel

- Three themes - **Light**, **Midnight**, **Neon** - switched in the top bar and remembered per browser. Each has its
  own colour set for charts and cards, and a slow-moving background glow.
- Blocks fade in one after another when a page opens; cards lift and glow on hover; bars and rows grow in.
- Sound effects for clicks, filters, theme changes and publishing; switch them off with the speaker button.
  Sounds are generated in the browser (no sound files) and never play until the user has clicked.
- Animations respect the operating system's "reduce motion" setting.
