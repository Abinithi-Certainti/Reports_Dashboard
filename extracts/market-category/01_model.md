# Market Category Report - model (from the 5 read-only DAX queries + PDF layout)

The report is the Waste Report's model (same Revenue_Append / Districts / Weekly Cogs / Products / Date tables,
see extracts/waste-report/01_model.md) **plus sales**, restricted to the **Market** brand (the convenience store).
Check values from the PDF are kept outside git (demo/private-data/) - the repository is public.

## What is different from the Waste Report
| Table | Source | Note |
|---|---|---|
| Weekly Cogs | WeeklyCogs ... `AND BrandName = 'Market'` | adds `new_inv_adj_quantity` (same 2023-05-28 rule) |
| Products | WeeklyCogsProdNum for `loc_code LIKE 'MKT%'` **UNION ~60 hard-coded promotion rows and ~16 hard-coded LCBO alcohol rows** | a promotion or beer SKU is added by editing the SQL |
| Market Sale (hidden) | SQL Server `POS_ORDERDETAILS`, Market stores, **2021-01-01 to 2022-05-01 only** | old history, loaded once |
| Market Sale-2 | incremental-refresh table; partitions 2024, 2025, 2026 by quarter/month/day | **its source SQL is not in INFO.PARTITIONS** (policy partitions carry none) - needs INFO.REFRESHPOLICIES |
| PLU and product number (hidden) | **Oracle `ocon.net-chef.com` (Net-Chef)**: t_recipe_location.plu_number -> t_product_company.product_name_number for locations `MKT%`, + hard-coded PROMOTIONS60000055 | a 4th source system |
| Date | dbo.date_table retail calendar, 2021 on, up to today | "Week filter across reports" slicer |

Sales rows (Market Sale query, same shape expected for Market Sale-2):
```sql
SELECT DISTINCT b.LB_NAME, b.locationname, plu, CAST(Endday AS date) AS endday, orderid, menuitemname,
       COUNT(CASE WHEN menuitemname LIKE '%PROMOTION%' THEN NULL ELSE plu END) AS count_of_plu,
       SUM(CASE WHEN ValueAddedBasePrice = 0 THEN Price ELSE ValueAddedBasePrice END - Discountamount) AS final_price
       -- "Changed 20250227 as ValueAddedBasePrice was $0 when Price > $0"
FROM POS_ORDERDETAILS a
JOIN (SELECT DISTINCT Storeid, BrandName, LocationName, CONCAT(hostlocationid, '-', BrandName) AS LB_NAME
      FROM NetSuiteLocation_Mapping WHERE ROLLOUT IN ('Yes','Suspended') AND BrandName = 'Market') b ON a.StoreId = b.StoreID
WHERE DepartmentName NOT IN ('Instant Tickets','Open Lottery','Gift Card','Retail - Gift Card','Gift Cards','Donations',
                             'Notes - Bev','Notes - Food','Notes','Fake Tray')
  AND Endday > '2020-12-31 00:15:00' AND Endday < '2022-5-1 00:15:00'
GROUP BY LB_NAME, locationname, CAST(endday AS date), plu, orderid, menuitemname
```
Sales reach a product through PLU: Market Sale[plu] -> PLU and product number[PLU_NUMBER] <-> (1:1, both directions)
Products[Product Number]; the measures force it with CROSSFILTER(..., both).

## Measures on the page (28 in the model, all Valid here)
| Column | Measure |
|---|---|
| BOP U / Receipt U / Rec $ / EOP U / EOP $ | SUM(begin_quantity) / SUM(purchase_quantity) / SUM(purchase_value) / SUM(end_quantity) / SUM(end_value) |
| Waste U / Waste $ | waste_quantity + new_inv_adj_quantity / waste_value + new_inv_adj_value |
| Sales U / Sales $ | SUM(count_of_plu) / SUM(final_price) over **Market Sale + Market Sale-2** |
| COGS $ | `CALCULATE(SUM(cogs), Revenue_Append[Brand] = "Market")` |
| GP $ / GP % | Sales $ - COGS $ / GP $ / Sales $ |
| WTD ... | from Start of Week to the end of the selected week (or the last date) |
| LW / LLW / LLLW ... | the week starting 7 / 14 / 21 days earlier |
| YTD ... | from the first retail week of the year to the last selected date |

## Layout (PDF, 1 page)
Filters: District_Director, Plaza, Category (export: Snack Food), "Week filter across reports" (single retail week).
Matrix: Plaza > Category > Sub Category (expandable) x BOP U, Receipt U, Rec $, EOP U, EOP $, Waste U, Waste $,
WTD Sales U / $ / GP %, LW Sales U / $ / GP%, LLW ... (cut off on the right).

## Findings
1. **Data gap**: Market Sale covers 2021-01-01 to 2022-04-30; Market Sale-2 partitions start 2024-01-01. Sales for
   **May 2022 - Dec 2023 are not in the model** (unless the refresh policy dropped them). LW/YTD figures in that range would be wrong.
2. **Four source systems**: SQL Server, Oracle Net-Chef (PLU mapping), plus the retail calendar; the PLU -> product
   link has no table in the new PostgreSQL.
3. ~76 products are **hard-coded in SQL** (promotions and LCBO beer); one alcohol row repeats its name twice in
   item_description ("...12PKLCBO: MOLSON CANADIAN 473ML 12PK").
4. Promotion lines count as $ but not units (count_of_plu ignores `%PROMOTION%`), so Promotions shows 0 units and
   negative $ - by design.
5. BOP U / EOP U are plain sums: right for one week, wrong if more than one week is ever selected.
6. The Products <-> PLU 1:1 both-direction relationship breaks if a product has two PLUs (Removed Duplicates keeps one).
