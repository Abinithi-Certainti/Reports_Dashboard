# Sales and Margin report with Budget - model (from the 5 read-only DAX queries + PDF layout)

Check values from the PDF are kept outside git (`demo/private-data/sales-margin-check.json`) - the repository is public.
Server names and the SharePoint link are left out on purpose.

## Pages
| Page | What it shows |
|---|---|
| GP by Locations | Matrix, one row per Plaza (expand to Brand). Slicers: Plaza, Brand, District Director, Year, Period, and a Calendar radio list of retail weeks ("Period 9 - Week 37: 09/06/2026 - 09/12/2026"). Columns: WTD Sales $, WTD Budget Sales, WTD Sales Variance, WTD GP $, WTD Budget GP$, WTD GP$ Var, WTD GP %, WTD Bud %, WTD GP% Variance, then the same for MTD (and YTD, off-screen) |
| Retail Calendar | Reference grid: retail week 1..52 start dates by year 2021-2025 ("Drop 1st week of calendar week") |

## Tables and their sources (all old SQL Server unless noted)
| Table | Source | Used for 2026? |
|---|---|---|
| POS Order 20121220 onwards | `POS_ORDERS` from 2022-12-01, `OrderTypeName <> 'Cash Drop'`, grouped by day + store: COUNT(OrderID), SUM(net) | **Yes - the sales** |
| Card fees | `POS_ORDERDETAILS`, `MenuItemName = 'Card Fee'`, brands `LIKE 'mark%'` (Market), SUM(ValueAddedBasePrice) | **Yes - subtracted** |
| Deposits | `POS_ORDERDETAILS`, `DepartmentName = 'Alcohol Deposit - Beer'`, SUM(ValueAddedBasePrice) | **Yes - subtracted** |
| Weekly Cogs | `WeeklyCogs` joined to NetSuiteLocation_Mapping on loc_code = CTLocation, last 2 years | **Yes - COGS** |
| SQL Sales budget table | `Sales_2023..2026_UnPivot_New` (UNION), daily rows | **Yes - budget** |
| SQL GM budget table | `GM_2023..2026_UnPivot_New` (UNION), daily rows | **Yes - GP budget** |
| Revenue_Append | NetSuiteLocation_Mapping UNION RevenueCenter + LocationHierarchyItem, **+ 2 hard-coded rows** ('4606 -Tim Hortons DT' Maple, '3640 -Utility' Newcastle), ~20 plaza renames ("N. Cambridge ON S" -> "Cambridge North" ...) | Yes - Plaza/Brand |
| Districts | plaza -> district director | Yes - slicer |
| Date | dbo.date_table (retail calendar) | Yes |
| POS Order & Ref | same as POS Order, **before** 2022-12-01 (+ hard-coded "WoodStock Mkt June 20&21" rows) | No - outside the 2-year window |
| GuestCheckHist | old POS (SUBTOTAL, TRANSACTIONID) | No - pre-2021 history |
| GiftCard and Lottery | `POS_ORDERDETAILS` gift card / lottery departments | Only before 2021-08-13 |
| Lottery Variance | SharePoint Excel file | Only up to 2021-08-13 |
| Retail Calendar | `CALENDAR("2021-01-03","2026-01-03")` with hard-coded week exceptions | Page 2 only |

Every fact table joins to Revenue_Append by `HostLocationID-Brand` (upper-cased; Wendy's -> WENDYS, TIM HORTONS DT -> TIM HORTONS,
Starbucks DT -> Starbucks) and to Date by its day column. Budget brand fixes: NYF -> NEW YORK FRIES, MIC -> ADMIN, ONCARE -> UTILITY,
STARBUCKS KIOSK / DT -> STARBUCKS, BURGERKING -> BURGER KING. Budget date 2022-01-01 is replaced by 2023-01-01.

## Measures (76 in the model: 68 Valid, 8 InvalidExpression - the invalid ones are old trials not on the page)
| Measure | Formula (plain English) |
|---|---|
| Sales $ | POS net (after 2021-08-13) **+** GuestCheckHist + POS Order & Ref **-** Card fees **-** Deposits. Before 2021-08-13 it also subtracts Market lottery and the lottery variance file. **For 2026 this reduces to: POS net - Card Fee - Beer deposit** |
| COGS $ | SUM(weekly_cogs.cogs) |
| GP $ / GP % | Sales - COGS / GP ÷ Sales |
| Daily budget / Daily GM budget | SUM(sales budget value) / SUM(GM budget value) |
| WTD Sales $, WTD COGS $ | the measure between the selected week's Start of Week and End of Week (or the last date, if the week is not finished) |
| WTD Budget Sales | `[Daily budget]` for the selected week |
| WTD Sales Variance | WTD Sales - Daily budget |
| WTD GP$ Var | WTD GP - Daily GM budget |
| WTD Bud % | 1 - (Budget - GM budget) ÷ Budget  = GM budget ÷ Budget |
| WTD GP% Variance | WTD GP % - WTD Bud % |
| MTD ... | the same, from `Start of week by period` (first day of the retail period) to the last selected date |
| YTD ... | the same, from `first retail week by year` to the last selected date |
| Closing Inventory $ | ABS(end_value, adjusted at month end) - not on page 1 |

## New database mapping (from the 2026-09-25 structure)
| Old | New (schema master) | Note |
|---|---|---|
| POS_ORDERS | `pos_orders` (net, end_day, order_type_name, store_id) | order_type_name is an enum - value for 'Cash Drop' to be checked |
| POS_ORDERDETAILS | `pos_order_details` (menu_item_name, department_name, value_added_base_price, end_day, store_id) | |
| NetSuiteLocation_Mapping | `netsuite_location_mapping` (store_id, host_location_id, brand_name, location_name, rollout) | |
| WeeklyCogs | `weekly_cogs` | proven equal to staging (AG-74) |
| Sales_20xx_UnPivot_New | `vena_sales` or `"Sales"` (same columns) | which one is loaded - probe |
| GM_20xx_UnPivot_New | `vena_gross_margin` or `"Gross Margin"` | which one is loaded - probe |
| date_table | `date_table` (start_of_week, end_of_week, retail_period, retail_year, retail_period_start_date) | |
| Districts | `district_directors` | |
| GuestCheckHist, Lottery Variance (SharePoint) | **none** | not needed for 2024 onwards |
