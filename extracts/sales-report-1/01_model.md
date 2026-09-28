# Sales Report 1 - model (AG-79, from the 5 read-only DAX queries + the 11-page PDF)

Check values from the PDF (Date 2026-06-01 to 2026-06-16, all filters All) are kept outside git in
`demo/private-data/sales-report-1-check.json`, because the repository is public. Server names and the SharePoint
link are left out on purpose.

## Pages
| # | Page | What it shows |
|---|---|---|
| 1 | Daily Sales - Total Road | One column per weekday (Sunday to Saturday), totalled over the selected dates: Sales, Transactions, Labour Hours Direct, SPLH and Average Check, each with PY, YOY and YOY % |
| 2 | Sales by Plaza and Brand | Matrix: Plaza, expanding to Brand, × each day |
| 3 | Sales by Brand and Plaza | Matrix: Brand × each day. This page also has an **AGM** slicer |
| 4 | Sales YOY % | Week ending (rows) × weekday (columns), plus YOY % by retail week |
| 5 | Transactions YOY % | Week ending × weekday |
| 6 | Labour Hours Total Plaza | Plaza (and Brand) × day: Labour Hours Direct |
| 7 | Labour Hours Direct by Plaza and Brand | The same, one brand selected (the PDF shows ADMIN) |
| 8 | Sales YOY % by Brand and Plaza | Brand (and Plaza) × week ending |
| 9 | Daily Sales & YOY % | Plaza × week ending: Sales, Sales YOY % |
| 10 | Daily Sales & Labour Hours YOY % | Plaza × day: Sales, Sales YOY %, Labour Hours Direct, Labour Hours Direct YOY % |
| 11 | Daily Sales - Total Road (by weekday) | Page 1's layout with no dates in the export |

Filters on every page: Date range, Plaza, Brand, District Director (and AGM on page 3).

## Tables and sources (old SQL Server unless noted)
| Table | Source | Needed for 2024 onwards? |
|---|---|---|
| POS Order 20201130 | `POS_ORDERS` from 2026-05-01, not Cash Drop, per day + store: COUNT(OrderID), SUM(net). **Maple Tim Hortons drive-thru orders become brand "Tim Hortons DT"** (DTfilter = 'Drive-Thru-Maple-Tim Hortons') | Yes |
| POS Order & Ref | The same query **before** 2026-05-01 (the split date moved: it was 2022-12-01 in the Sales and Margin report), + WoodStock June 2020/21 rows | Yes: it holds everything before May 2026, PY included |
| Cardfee | `POS_ORDERDETAILS`, MenuItemName 'Card Fee', Market brands, from 2022-04-01 | Yes (subtracted) |
| Deposits | `POS_ORDERDETAILS`, 'Alcohol Deposit - Beer', last 2 years | Yes (subtracted) |
| Labor Hour on &after 0621 | `EmployeePaySummaryv2`: location not like '%resource%', PayCategory in (OT1.5, Reg, Hol1.5), Job in (CREW MEMBER, LEAD, SHIFT SUPERVISOR, UTILITY). Location is upper-cased and cleaned with ~12 text replaces ("TRAVEL PLAZA ", " ONSITE", NYF, DDT, A&W spellings...). It joins to Revenue_Append on "Plaza Brand" text | **Yes: labour** |
| Temp DLH | `Temp_DLH` (plaza, brand, DLH_Date, DLH), joined on "Plaza Brand" | Yes |
| TMR_vending&MKT Express | `TimeCardDetail` + RevenueCenter + JobCode, vending / express revenue centres | Yes, but **no table in the new DB** |
| PUNCHTIME, PunchTime_full, DEPTID | `EmployeePunchTime` before 2020-06-21 | No |
| GuestCheckHist, GiftCard and Lottery, Lottery Variance (SharePoint) | old POS / lottery | No (before 2021-08-13) |
| Revenue_Append | Same as the Sales and Margin report (NetSuite mapping + RevenueCenter, 2 hard-coded rows, plaza renames). Adds **"LB name" = Plaza & " " & Brand** for the labour join | Yes |
| District | District_Directors + a **hard-coded AGM list** (Central / East / West by HostLocationID, else TBD) | Yes |
| 3640 Utility | 1 hard-coded row (Newcastle Utility) | Yes |
| Date | dbo.date_table (retail calendar) | Yes |

Brand names here are **not** merged the way the Sales and Margin report merges them: STARBUCKS DT stays its own brand.

## Measures (30, all Valid: 11 in "Report", 19 in "Daily")
| Measure | Formula (plain English) |
|---|---|
| Sales | POS net (Cash Drop out) − Market card fees − beer deposits (+ the old pre-2021 sources) |
| Transactions | number of POS orders (Cash Drop out) |
| Labour Hours Direct | employee_pay_summary hours (the filters above) + vending/express hours (not SHFT MGT) + Temp DLH |
| SPLH | Sales ÷ Labour Hours Direct |
| Average Check | Sales ÷ Transactions |
| … PY | the same measure on **the same weekday of the same retail week, one retail year earlier** (Date[DWY] − 1, where DWY = weekday × 1,000,000 + retail week × 10,000 + retail year). Five 31-December dates use week − 52 instead |
| … YOY $ / YOY % | measure − PY / (measure − PY) ÷ PY |
| Labour Hours, hour difference, Labour hour other, Temp DLH, Cookie-item donation, Mkt lottery, the "PY first step" measures | helpers, not on the pages |

## New database mapping (2026-09-25 structure)
| Old | New (schema master) | Note |
|---|---|---|
| POS_ORDERS | `pos_orders` | the same as AG-76 |
| POS_ORDERDETAILS | `pos_order_details` | card fees, deposits |
| EmployeePaySummaryv2 | `employee_pay_summary` (location, job, pay_date, pay_category, hours) | the column names match |
| Temp_DLH | `temp_dlh` (plaza, brand, dlh_date, dlh) | |
| TimeCardDetail + JobCode | **none** (revenue_center exists) | vending / express hours are missing: see the open questions |
| NetSuiteLocation_Mapping, District_Directors, date_table | `netsuite_location_mapping`, `district_directors`, `date_table` | |
| (possible shortcut) | `v_vena_labour_daily_load` (_Location, _Brand, _Date, _Value) | a daily labour view; whether it equals Labour Hours Direct is unknown - probe 26 |

## What the engine needs for this report
1. **PY / YOY measures**: the same measure over the same days one retail year earlier. This is a new window type, next to wtd / ptd / ytd.
2. **Weekday** and **week ending** as dimensions. The dataset can provide these from date_table.
3. The matrix (rows × day columns) already exists.

## Open questions
1. Vending / Market Express hours (TimeCardDetail) have no table in the new DB. Are they still needed, or loaded elsewhere?
2. The AGM groups (Central / East / West) are a hard-coded list of HostLocationIDs in the report. Where should that list live?
3. The labour join is on free text ("CAMBRIDGE NORTH TIM HORTONS" = Plaza + Brand). Could the new DB carry a host location id on employee_pay_summary instead?
