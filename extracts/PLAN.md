# Report migration - agreed plan (the user, 2026-09-28)

## Goal
Formulas, tables, mappings and fields matter most. Matching the old numbers exactly is NOT a goal.

## Order of work
1. Finish report #10 (the last of the 10 business-priority reports).
2. **Move every report to the QA database.** All tables, fields and data come from QA.
   - A field with no table in QA is marked **Missing in QA**, then looked up in DEV. If DEV has it, DEV is used
     for now and the mapping says so.
3. **Mapping dashboard**: one dashboard covering all 10 reports. For every field:
   old table.column -> new table.column (QA, or DEV when missing in QA), old DAX formula -> new SQL formula,
   status (found in QA / missing in QA - taken from DEV / missing in both).
   Audience: our team, the tech lead **and the business team**, so every formula also gets a plain-English line.
4. **UI improvements**: reports do not all need the same UI. For each report the agent proposes 2-3 improvements
   (filters, drill-down, charts); the user approves before anything is built.

## Reports
| # | Report | Jira | Status |
|---|---|---|---|
| 1-5 | Tender, Waste, Market category, People count, Radar car count | earlier AG tickets | built / extracted |
| 6 | Sales and Margin with Budget | AG-76 | built on sample data |
| 7 | Sales Report 1 | AG-79 | built, real QA sales for 1 store |
| 8 | Sales Report - Including Budget 2026 | AG-80 | extracted; budget tables not found in the DB checked |
| 9 | Sales Report Field Team | AG-81 | extracted |
| 10 | Financial Reports (HST, Gift Card, Donations, Lottery) | AG-82 | extracted; 2 helper queries needed |

## Data rule v3 (the user, 2026-09-28, replaces v2 and v1 below)
- **The reports use the DEV database** (kios_etl DEV, schema master) - decided by the user after a Power BI developer's
  advice, and after the QA vs DEV comparison (`extracts/new-db/qa_vs_dev_2026-09-28.md`).
- Why: DEV holds the store mapping, district directors, retail calendar, COGS and budgets that QA lacks.
- Known gaps on DEV: labour (employee_pay_summary) and temp_dlh are empty; people_count and car_count are empty;
  sales are thin (few orders per store per day, May-July 2026); no last-year sales.
- Still: no mock data, no fixed dates, SELECT only. The demo is labelled "DEV data".
- The QA-only SQL is kept (e.g. `reports/tender-report/dataset.qa.sql`) for switching back later.

## Data rule v2 (superseded by v3)
- **Remove all mock / sample data.** Every report shows only data loaded from the QA database.
- **No fixed dates.** Each report uses whatever date range QA holds; the date filter opens on QA's available days.
- A report whose tables are not in QA shows a clear "no QA data yet" state instead of made-up rows.

## Data rule v1 (superseded)
Every report takes its data from **QA**. Where QA has no data for a table (a missing table, an empty table, or a
store/day QA does not hold), the demo uses **made-up sample rows**, clearly labelled as sample. DEV is used only to copy
lookups (plaza names) once.

## Rules that still apply
- **2026-09-28 decision (the user):** QA checks run with the Read_Write login (`kios_etl_QA`), without waiting for
  readonly_user grants. Only SELECT queries are run with it - never UPDATE / DELETE / INSERT / DROP / ALTER.
- The repository is public: no real figures, hostnames, SharePoint links or email lists in git.
