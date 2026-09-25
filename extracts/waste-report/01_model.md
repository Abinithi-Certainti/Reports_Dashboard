# Detailed Waste Report - model (from the 5 read-only DAX queries)

## Tables (all Import, all from SQL Server ETLServerSQL unless noted)
| Table | Source | Used for |
|---|---|---|
| Weekly Cogs | `WeeklyCogs` + NetSuiteLocation_Mapping + WeeklyCogsProdNum | every number on the page (one row per plaza / product / week) |
| Products | `WeeklyCogsProdNum` (products that appear in WeeklyCogs) | Category, Sub Category, Item Description filters |
| Revenue_Append | NetSuiteLocation_Mapping UNION RevenueCenter + LocationHierarchyItem (+ a hard-coded "3640-Utility, Newcastle" row) | Plaza, Brand, District, District Director |
| Districts | `District_Directors` | District / District Director (merged into Revenue_Append) |
| Date | `dbo.date_table` (retail calendar, 2021 on, up to the last Saturday) | Retail Year and Retail weeknum filters |
| Reports | DAX `Row("Column", BLANK())` | holder for measures |
| Retail Calendar | DAX `CALENDAR(2019-01-01, 2022-01-02)` | old calendar, hidden, not used by this page |
| DateTableTemplate / LocalDateTable_* | Power BI auto date tables | internal |

## Relationships
Weekly Cogs[lb_name] -> Revenue_Append[LOCATIONID&BRAND]; Revenue_Append[Plaza] -> Districts[Plaza];
Weekly Cogs[key_column] -> Products[key_column]; Weekly Cogs[period] -> Date[Date].

## Source SQL (decoded)
```sql
-- Weekly Cogs
SELECT a.*,
       CASE WHEN a.start_date < '2023-05-28 00:00:00' THEN 0 ELSE a.inv_adj_value END AS new_inv_adj_value,
       concat(b.hostlocationid, '-', b.BrandName) AS lb_name, b.locationname,
       concat(c.product_num, c.category, c.sub_category) AS key_column
FROM WeeklyCogs a
JOIN (SELECT DISTINCT CTLocation, locationname, BrandName, HostLocationID FROM NetSuiteLocation_Mapping
      WHERE HostLocationID IS NOT NULL AND (ROLLOUT = 'Yes' OR ROLLOUT = 'Suspended')) b ON a.loc_code = b.CTLocation
LEFT JOIN WeeklyCogsProdNum c ON a.product_num = c.product_num
-- then lb_name: "Wendy's" -> "WENDYS"

-- Products
SELECT DISTINCT b.product_num, product_name, category, sub_category,
       concat(b.product_num, category, sub_category) AS key_column,
       concat(b.product_num, '-', product_name) AS item_description
FROM WeeklyCogsProdNum a JOIN (SELECT DISTINCT product_num FROM WeeklyCogs) b ON a.product_num = b.product_num
-- the "Product Name" column is then renamed "heavy cream" (2026-07-06) - an accidental rename

-- Revenue_Append: NetSuiteLocation_Mapping (ROLLOUT Yes/Suspended) UNION RevenueCenter joined to
-- LocationHierarchyItem, excluding ~20 names (*CLSD..., CASHROOM, MAINTENANCE, COMMON AREA, ...), plus one
-- hard-coded row '3640-Utility' at Newcastle. Then ~25 text replaces for plaza names ("S. Tilbury ON S" ->
-- "Tilbury South") and brand names (NY FRIES -> NEW YORK FRIES, STARBUX -> STARBUCKS, TIM H DRIVE THRU -> TIM
-- HORTONS), upper-case brands, keep first row per LOCATIONID&BRAND, left-join Districts.
```

## Measures used on the page (table "Reports")
| Column on page | Measure | DAX |
|---|---|---|
| Unit Price | Unit Price $ | `SUM(unit_price)` |
| Begin $ | FirstWeek Begin $ | `SUM(begin_value)` for the FIRST retail week in the selected range |
| Purchase $ | column used directly | `SUM(purchase_value)` |
| Adj $ | (see finding 3) | |
| Var Adj Value | column used directly | `SUM(var_adj_value)` |
| End $ | LastWeek End $ | `SUM(end_value)` for the LAST retail week in the selected range |
| COGS $ | COGS $ | `SUM(cogs)` |
| Theocost $ | Theocost $ | `SUM(theo_cost)` |
| Waste $ | Waste $ | `SUM(waste_value) + SUM(new_inv_adj_value)` |
| Variance | Variance | `[COGS $] - [Theocost $] - [Waste $]` |

The model has 40 measures. **23 are broken** (State = InvalidExpression): they point at tables that no longer exist
(`piranha`, `Market Sale`, `Market Sale-2`, `PLU and product number`) - every Sales, GP, WTD, LW/LLW/LLLW, MTD and YTD
measure. They are not on this page and should not be migrated.

## Layout (PDF, 1 page)
Filters: District_Director, Plaza, Brand (export: BURGER KING), Category, Item Description, Retail Year (2025),
Retail weeknum range (1 - 2). One matrix: rows = Plaza (expandable), columns as in the table above, Total row.

## Check values (Total row, Burger King, retail year 2025, weeks 1-2)
| Unit Price | Begin $ | Purchase $ | Adj $ | Var Adj | End $ | COGS $ | Theocost $ | Waste $ | Variance |
|---|---|---|---|---|---|---|---|---|---|
| 4,548.53 | 206,878.05 | 141,292.89 | 5,094.93 | 12,342.32 | 189,663.95 | 154,844.50 | 138,804.24 | 5,094.93 | 10,945.33 |

Arithmetic checked on all 12 plazas and the total:
- Variance = COGS - Theocost - Waste: holds on every row.
- Begin + Purchase - End = COGS on 7 of 12 plazas; the other 5 differ (total 3,662.49), most likely transfers out or
  other adjustments that are not shown.

## Findings
1. **Unit Price is added up** (SUM of prices across products and weeks). The total 4,548.53 has no meaning.
2. **Begin $ / End $ are "first week" / "last week" values**, not sums - correct for stock, and the engine must do the same.
3. **Adj $ equals Waste $ on every row**. Either the Adj $ column shows the Waste $ measure by mistake, or waste_value is
   always 0 and all waste is carried in inv_adj_value (counted as waste only from 2023-05-28, `new_inv_adj_value`).
4. The Products column "Product Name" was renamed **"heavy cream"** on 2026-07-06 - looks accidental.
5. Plaza names keep " ON S" for Bainsville and Morrisburg on purpose (the replaces are undone for those two).
6. A hard-coded fake location "3640-Utility" at Newcastle is added to the plaza list.
7. 23 broken measures (see above).
