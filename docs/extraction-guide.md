# Extracting an old Power BI report (read-only)

How to pull everything we need out of one existing Power BI report without touching production.
Proven on the Tender Report on 24 Sep 2026.

## Safety rules

- Work in **Viewing** mode only. The green banner must say "You are in Viewing mode and changes will not be saved".
- Only run queries that start with `EVALUATE`. They read and never write.
- Never click **Apply**, **Update model with changes**, **Save to version history**, **Publish**, **Delete** or **Move to**.
- Do not run queries that return data rows (for example the sample `TOPN(100, ...)` query). We need structure only.

## Steps

1. In the Power BI Service, open the workspace and click the report's **Semantic model** item (not the Report item).
2. Top right: switch **Editing** to **Viewing**.
3. Bottom bar: open **DAX query view**.
4. For each query below: select all (Ctrl + A), delete, paste the query, click **Run**, copy the whole result.

| # | Query | Gives | Save as |
|---|---|---|---|
| 1 | `EVALUATE INFO.VIEW.TABLES()` | tables, DAX table formulas | `01_tables.tsv` |
| 2 | `EVALUATE INFO.COLUMNS()` | columns, data types, calculated columns | `02_columns.tsv` |
| 3 | `EVALUATE INFO.VIEW.MEASURES()` | DAX measures and formats | `03_measures.md` |
| 4 | `EVALUATE INFO.VIEW.RELATIONSHIPS()` | how tables are linked | `04_relationships.md` |
| 5 | `EVALUATE INFO.PARTITIONS()` | source SQL and Power Query steps | `05_sources.md` |

`INFO.VIEW.COLUMNS()` fails with a syntax error in this editor, so query 2 uses `INFO.COLUMNS()`.
Its `TableID` matches the `ID` from query 1, and `ExplicitDataType` is a code: 2 text, 6 whole number,
8 decimal (double), 9 date/time, 1 automatic.

5. Export the report page(s) to PDF from the **Report** item, for the layout. Save as `06_layout.md` notes
   (the PDF itself stays out of the repo, because it contains real figures).

## After extraction

1. Put the files in `extracts/<report-name>/`.
2. Add a seed file `db/seeds/NNN_<report_name>.sql` in the same shape as `001_tender_report.sql`.
3. Run `bash db/setup-local.sh` and check the row counts.
