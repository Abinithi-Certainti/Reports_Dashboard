# Reports_Dashboard

A repeatable process to move the old Power BI reports (SQL Server `ETLServerSQL`) onto the new PostgreSQL model,
with a new design, instead of rebuilding each report by hand. Tracked on Jira **AG-68**.

## Status

| Step | State |
|---|---|
| Extract old report structure | Done for **Tender Report** (1 of fewer than 50) |
| Report catalog database | Done: schema + Tender Report seed, verified locally |
| Old -> new table mapping | 4 tables, confirmed present in the new DB structure |
| Old -> new column mapping | 19 columns for the Tender Report; 1 (`CTLOCATION` -> `ct_location`) needs a person to confirm |
| Tender Report queries on PostgreSQL | `reports/tender-report/queries.sql`; syntax and names checked, numbers NOT yet reconciled (no data access) |
| Output method for new reports | Own website (React + Java report engine) - design in `docs/design/report-engine.md`, waiting for approval |

## Layout

```
db/
  migrations/   catalog schema (each migration has a .rollback.sql)
  seeds/        one file per extracted report
  setup-local.sh  rebuilds a throwaway local catalog DB from these files
extracts/<report>/  raw extraction results, one folder per report
docs/extraction-guide.md  how to extract a report safely (read-only)
reports/<report>/queries.sql  the report's source queries translated to PostgreSQL
tests/check_queries.sh  runs a report's queries against an empty copy of the new tables
```

## The catalog

Schema `catalog` stores, per report: model tables with their source SQL and Power Query steps, columns, DAX measures,
relationships, visuals and slicers, hidden business rules and findings. Two shared tables map old names to new:
`table_map` and `column_map`. Column mappings are filled only from a real comparison of both databases, never guessed.

Structure only: no production data rows are stored in this repo.

## Run locally

```bash
bash db/setup-local.sh
psql -h /tmp -p 5434 -U postgres -d report_catalog -c "select * from catalog.finding"
bash tests/check_queries.sh reports/tender-report/queries.sql
```

This environment cannot reach the DEV database directly (only HTTPS leaves the sandbox), so the new DB structure
is loaded from an `information_schema.columns` export in `extracts/new-db/`.
