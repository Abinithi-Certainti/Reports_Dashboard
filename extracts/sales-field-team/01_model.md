# Sales Report Field Team - model (AG-81, from the 5 read-only DAX queries + the 3-page PDF)

Check values from the PDF (Date 2026-02-15 to 2026-02-21, all filters All) are kept outside git in
`demo/private-data/sales-field-team-check.json`, because the repository is public. Server names and the SharePoint
link are left out on purpose.

**In one line:** an older, smaller copy of the Sales Report. Sales, Transactions, Labour Hours Direct (LHD), SPLH and
Average Check, each with PY / YOY / YOY %, plus **MTD** (calendar month to date). No budgets, no TPLH, no WTD/PTD/YTD
measures (the WTD column is just the total of the selected days).

## Pages
| # | Page | What it shows |
|---|---|---|
| 1 | Plaza Total Summary | Weekday columns (Sunday-Saturday) + WTD total, and an MTD block (calendar month) |
| 2 | Plaza by Brand | Brand (and plaza) × each day: Sales, Sales PY, YOY %, LHD, LHD PY, YOY %, SPLH |
| 3 | Rolling Weekly Sales | Week ending (Saturday) columns: the same measures |

Filters: Date range, Plaza, Brand, District Director, AGM.

## Tables and sources (old SQL Server)
| Table | Source | Needed for 2024 onwards? |
|---|---|---|
| POS Order 20121130 | `POS_ORDERS` **from 2022-12-01**, not Cash Drop, per day + store: COUNT(OrderID), SUM(net) | Yes |
| POS Order & Ref | the same query **before** 2022-12-01, + a hard-coded WoodStock Market June 2020/21 table | Only for PY of 2023 |
| Cardfee | `POS_ORDERDETAILS` 'Card Fee', Market brands, from 2022-04-01, **ROLLOUT = 'Yes' only** | Yes (subtracted) |
| Labor Hour on &after 0621 | `EmployeePaySummaryv2`: location not like '%resource%', PayCategory in (OT1.5, Reg, Hol1.5). **No job filter in SQL.** Only 3 text fixes (TRAVEL PLAZA, ONSITE, NYF) | Yes |
| Temp DLH | `Temp_DLH` | Yes |
| TMR_vending&mkt express | `TimeCardDetail` vending / express, from 2019-01-01. The WHERE has an AND/OR precedence slip (see note) | **Unknown** - no table in the new DB |
| District | District_Directors + the hard-coded AGM list | Yes |
| Revenue_Append | as AG-79 | Yes |
| Date | `CALENDAR(2018-01-01, TODAY())` | Yes |
| GuestCheckHist, PUNCHTIME, DEPTID, GiftCard and Lottery, Lottery Variance | before 2021-08-13 | No |

## Measures (on the pages)
| Measure | Formula (plain English) | Differs from AG-79? |
|---|---|---|
| Sales | POS net − Market card fees (+ the old pre-2021 sources) | **Yes: beer deposits are NOT subtracted** |
| Transactions | number of POS orders | No |
| Labour Hours Direct | pay-summary hours for every job **except** ASSOCIATE GM, GENERAL MANAGER, MANAGER IN TRAINING, OPERATIONS MANAGER, BRAND MANAGER + vending/express + Temp DLH | **Yes: AG-79 keeps only CREW MEMBER, LEAD, SHIFT SUPERVISOR, UTILITY** |
| SPLH, Average Check | Sales ÷ LHD, Sales ÷ Transactions | No |
| … PY | same retail weekday one year earlier (DWY − 1), with fixes for 31 Dec and 1-6 Jan 2023 | No |
| MTD … | calendar month to date (DATESMTD), not retail period | **New** |
| hour difference | InvalidExpression (refers to a removed measure) | not used |

### Proof the differences are real (same days as report #8, AG-80)
- 2026-02-15 sales: Field Team $524,286, Budget 2026 report $524,107. The $179 gap is beer deposits.
- Transactions are identical on every day.
- LHD is identical this year on the days checked, but PY differs slightly on 2025 days (e.g. 4,729 vs 4,714): the job
  filters are not the same.

**Note on the vending query:** `WHERE BUSINESSDATE >= '2019-01-01' and b.Name like '%vending%' or b.NAME like '%express%'`
is read by SQL as `(date AND vending) OR express`, so express rows from any date are included.

## New database mapping (2026-09-25 structure)
Same as AG-79: `pos_orders`, `pos_order_details`, `employee_pay_summary`, `temp_dlh`, `netsuite_location_mapping`,
`district_directors`, `date_table`. TimeCardDetail has no table.

## What the engine needs
1. An **MTD** window (calendar month to date). The engine has wtd / ptd / ytd on the retail calendar only.
2. Everything else exists (PY, YOY, ratio measures, week-ending dimension).

## Open questions
1. This report and Sales Report 1 / Budget 2026 define Sales and LHD differently (deposits, job filter). Should the
   new version keep each report's own rule, or use one shared definition?
2. Vending / express hours: are they still used, and is there a new table for them?
