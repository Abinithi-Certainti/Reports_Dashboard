# Reports_Dashboard

A repeatable process to move the old Power BI reports (SQL Server `ETLServerSQL`) onto the new PostgreSQL model,
with a new design, instead of rebuilding each report by hand. Tracked on Jira **AG-68**.

## Status

| Step | State |
|---|---|
| Extract old report structure | Done for **Tender Report** (1 of fewer than 50) |
| Report catalog database | Done: schema + Tender Report seed, verified locally |
| Old -> new table mapping | 4 tables, from AG-66, not yet checked against the new DB |
| Old -> new column mapping | Not started. Needs read access to the new PostgreSQL DEV DB |
| Output method for new reports | Not decided |

## Layout

```
db/
  migrations/   catalog schema (each migration has a .rollback.sql)
  seeds/        one file per extracted report
  setup-local.sh  rebuilds a throwaway local catalog DB from these files
extracts/<report>/  raw extraction results, one folder per report
docs/extraction-guide.md  how to extract a report safely (read-only)
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
```
