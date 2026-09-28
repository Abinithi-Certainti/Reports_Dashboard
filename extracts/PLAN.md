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

## Rules that still apply
- Read-only login (`readonly_user`) only.
- The repository is public: no real figures, hostnames, SharePoint links or email lists in git.
