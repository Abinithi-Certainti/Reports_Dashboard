# Weekly COGS on QA (kios_etl) - probe results, 2026-09-25 (queries 8-10 of tools/radar_probe.sql)

| # | Check | Result |
|---|---|---|
| 8 | master.weekly_cogs | 28,778 rows, 103 locations, **one week only: 2026-06-27** |
| 9 | temp_weekly_cogs_staging by status | LOADED 57,556 rows (processed 2026-09-24 10:01-10:05); TRANSFORMED 28,778 (processed_at empty) |
| 10 | fields inside parsed_data | 26 fields, every one present on all 86,334 rows |

Fields in parsed_data: begin_quantity, begin_value, category, cogs, end_quantity, end_value, inv_adj_quantity,
inv_adj_value, inv_unit, loc_code, micro_category, period, product_name, product_num, purchase_quantity,
purchase_value, sub_category, theo_cost, theo_depletion, transfer_out_quantity, transfer_out_value, unit_price,
var_adj_quantity, var_adj_value, waste_quantity, waste_value.

## What it means
- **The full detail the Waste Report needs exists** - but only inside the staging table's jsonb, not in weekly_cogs.
  Compared with the old WeeklyCogs, only WeeklyCogs_ID, Start_Date and createdate are missing (period can stand in
  for Start_Date in the 2023-05-28 rule).
- **weekly_cogs lost the product**: it has 28,778 rows - one per product per location - but no product_num column,
  so a row cannot be tied to a product. Waste, theo cost and begin values are dropped too.
- 86,334 = 3 x 28,778: the staging table looks like **the same week loaded three times** (once TRANSFORMED, twice
  LOADED). Reading it without picking one load would count everything 3 times. Not yet proven - probes 11-12 check it.
- Only one week (2026-06-27) is on QA, so the PDF check values (2025 weeks 1-2) cannot be reproduced. A Power BI
  export filtered to the week of 2026-06-27 would give check values that can be.
- transfer_out_value is in the data; it may explain why Begin + Purchase - End differs from COGS at 5 plazas.

## Queries 11-12 (same day)
| Load (execution_id) | Status | Rows | Loaded at | Distinct location+product | COGS | Waste value | Theo cost |
|---|---|---|---|---|---|---|---|
| f435ff5b... | TRANSFORMED | 28,778 | 2026-09-24 15:11:16 | 28,778 | 1,659,260.49 | 0.00 | 1,529,415.32 |
| b6e937c4... | LOADED | 28,778 | 2026-09-24 15:31:20 | 28,778 | 1,659,260.49 | 0.00 | 1,529,415.32 |
| f78460f2... | LOADED | 28,778 | 2026-09-24 15:35:52 | 28,778 | 1,659,260.49 | 0.00 | 1,529,415.32 |

Confirmed: **three identical loads of the same week** (no duplicates inside a load). `waste_value` is 0 on every row,
so all waste is in `inv_adj_value` - which is why "Adj $" equals "Waste $" in the old report. `period` is text in
MM-DD-YYYY form.

## Prototype
`reports/waste-report/dataset.sql` reads only the latest load of each week. `reports/waste-report/check_totals.sql`
gives per-plaza totals for Burger King, week of 2026-06-27, to compare with a Power BI export of the same week.
Both ran against the new table structure (tests/check_queries.sh), and a test with 3 identical fake loads gave
single (not tripled) totals.

## Engine gaps for this report (not built yet)
- Begin $ / End $ need "first week" / "last week" measures; the engine has only sum/count/min/max/avg.
- Retail Year / Retail week filters need the retail calendar (dbo.date_table), which is not in the new DB.
