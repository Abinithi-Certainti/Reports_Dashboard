# Sales Report - Including Budget 2026 - model (AG-80, from the 5 read-only DAX queries + the 9-page PDF)

Check values from the PDF (main filter: Date 2026-02-15 to 2026-02-18, all other filters All) are kept outside git
in `demo/private-data/sales-budget-2026-check.json`, because the repository is public. Server names, the SharePoint
link and the GM email list are left out on purpose.

**In one line:** this is Sales Report 1 (AG-79) plus three 2026 budgets (sales, transactions, labour hours), plus
TPLH, plus WTD / PTD / YTD totals, plus a second kind of "last year" (by calendar date).

## Pages
| # | Page | What it shows |
|---|---|---|
| 1 | Plaza Total Summary - Retail Calendar | Weekday columns + WTD Total: Sales, Transactions, Labour Hours Direct (LHD), SPLH, TPLH, Average Check. Each with PY, YOY, YOY %, Budget, vs Budget, vs Budget %. Plus a PTD block |
| 2 | Detailed View | WTD, PTD and YTD blocks of the same measures (year-level selection) |
| 3 | Retail Periods / Weeknum | Lookup grid: retail period, week and weekday → calendar date, 2019-2026 |
| 4 | Budget by Dates (sales) | Plaza × day sales budget, and brand × retail period |
| 5 | Budget by Dates (transactions) | Plaza × day transactions budget, and plaza/brand × period |
| 6 | Budget by Dates (labour hours) | Plaza × day LHD budget, and plaza × period |
| 7 | Alert | PTD block + a full week (Sunday-Saturday) of page 1's grid |
| 8 | Plaza Total Summary - Future | The same as page 1 |
| 9 | Plaza Total Summary - Finance | Page 1, but PY is **the same calendar date one year earlier** ("FIN"), not the same retail weekday |

Filters: Date range (or Year / Period / Week), Plaza, Brand, District Director, AGM.

## Tables and sources (old SQL Server)
| Table | Source | Needed for 2024 onwards? |
|---|---|---|
| POS Order part 1 / part 2 | `POS_ORDERS` split at 2025-12-01 (part 1 from 2021-01-03). Same as AG-79 | Yes |
| Cardfee, Deposits | `POS_ORDERDETAILS`: Market card fees, beer deposits. Same as AG-79 | Yes (subtracted) |
| Labor Hour on &after 0621 | `EmployeePaySummaryv2`, the same filters as AG-79. **5 more text fixes** than AG-79: A&W → ANW everywhere, MALLORYTOWNNORTH, TRENTONNORTH, TRENTONSOUTH, WESTLORNE, BURGERKING | Yes |
| Temp DLH | `Temp_DLH` | Yes |
| TMR_vending&mkt express | `TimeCardDetail`, **only 2019-01-01 to 2020-01-04** | **No** - it holds 2019 only |
| **2026 SQL Sales budget table** | `Sales_2026_UnPivot_New` | **Yes: new** |
| **2026 SQL transactions budget table** | `Transactions_2026_UnPivot_v2` | **Yes: new** |
| **2026 SQL DLH budget table** | `DLH_2026_UnPivot_New` | **Yes: new** |
| 2026 Entire Year ... Budgets | copies of the three budget tables, used for totals that ignore the date filter | Same data |
| Revenue_Append, Districts (+ AGM list), Date, Retail Calendar | as AG-79 | Yes |
| GuestCheckHist, PUNCHTIME, DEPTID, GiftCard and Lottery, Lottery Variance | before 2021-08-13 | No |
| 2026 GM budget | `Daily GM budget` points at a table that no longer exists (InvalidExpression) | No |

### Budget table clean-up (Power Query, same for all three)
1. Brand upper-cased, then: NYF → NEW YORK FRIES, STARBUCKS KIOSK → STARBUCKS, WENDY'S → WENDYS.
2. **Labour budget only:** MIC → ADMIN, ONCARE → UTILITY.
3. Key `LBRAND` = HostLocationID & "-" & Brand. It joins to Revenue_Append's LOCATIONID&BRAND (the same key the POS rows use).
4. Date 2022-01-01 is moved to 2023-01-01 (old fix, does not touch 2026).
5. `Retail weeknum` = Excel week number − 1 (0 → 52), and a "Retail Period" from it. These are only used for the page 4-6 period grids; the main pages use the Date table.

## Measures (294 in the model; the ones on the pages)
| Measure | Formula (plain English) |
|---|---|
| Sales $, Transactions, LHD, SPLH, Average Check | as AG-79 |
| **TPLH** | Transactions ÷ LHD |
| **Sales Budget** (Daily budget) | sum of sales budget `value` for the selected days |
| **Trans budget** | sum of transactions budget `value` |
| **LHD budget** | sum of labour-hours budget `value` |
| Budget TPLH | Trans budget ÷ LHD budget |
| Budget Avg Check | Sales Budget ÷ Trans budget |
| … vs Budget / vs Budget % | actual − budget / (actual − budget) ÷ budget |
| … PY, YOY, YOY % | same retail weekday one retail year earlier (as AG-79) |
| … PY FIN, YOY FIN, YOY FIN % | **same calendar date one year earlier** (YMD − 10000) |
| … P3Y | same retail weekday three retail years earlier (pages not in the PDF) |
| WTD / PTD / YTD … | the measure from the start of the retail week / period / year to the last selected day |
| Inactive Stores' budget | budget rows with no match in Revenue_Append (helper, not on the pages) |

## New database mapping (2026-09-25 structure)
| Old | New (schema master) | Note |
|---|---|---|
| Sales_2026_UnPivot_New | `vena_sales` **or** `"Sales"` | Both have budget_year, Region, Location, Brand, value, TimePeriod, TimePeriod_Date, HostLocationID. Same open question as AG-76: probe B1 decides |
| Transactions_2026_UnPivot_v2 | `vena_transactions` **or** `"Transactions"` | probe B2 |
| DLH_2026_UnPivot_New | `vena_labour_hours` **or** `"DLH"` | probe B3 (also `vena_labour_hours_dump`, `_dump_1` exist) |
| Everything else | as AG-79 (`pos_orders`, `pos_order_details`, `employee_pay_summary`, `temp_dlh`, `netsuite_location_mapping`, `district_directors`, `date_table`) | |

## What the engine needs
1. Budget measures: plain sums from a budget source. The dataset can carry them as extra rows (value 0 on the POS rows), as AG-79 does for labour.
2. TPLH and the budget ratios: ratio measures, already supported.
3. **PY FIN (calendar-date last year):** a new window next to `py`. `py` shifts by one retail year (364 days); `py_fin` would shift by one calendar year.
4. WTD / PTD / YTD: already supported.

## Open questions
1. Which budget tables: `vena_*` or `"Sales"` / `"Transactions"` / `"DLH"`? Probes B1-B3 answer this against the PDF.
2. Is the budget loaded for the whole of 2026 in the new DB (the PDF has budget from 2025-12-28)?
3. `Retail weeknum` in the budget tables is Excel week − 1, which is not the real retail week. Only the period grids use it. Keep it, or use the real retail calendar?
