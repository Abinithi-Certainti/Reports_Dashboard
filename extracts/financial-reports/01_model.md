# Financial Reports - model (AG-82, from the 5 read-only DAX queries + the 4-page PDF)

Check values from the PDF (Date 2024-02-05 to 2026-09-27, all filters All) are kept outside git in
`demo/private-data/financial-reports-check.json`, because the repository is public. Server names are left out.

**In one line:** four daily money reports by Plaza (and Brand): HST (sales tax), Gift Card sales, Donations,
and Lottery (sales vs redemptions). Simple sums, one PY measure, no budgets.

## Pages
| # | Page | What it shows | Filters |
|---|---|---|---|
| 1 | HST by Plaza and Brand | Plaza (-> Brand) × day: HST | Date, Plaza, Brand, District Director |
| 2 | Gift Card | Plaza (-> Brand) × day: Gift Card; summary by Brand | the same |
| 3 | Donations | Brand (-> Plaza) × day: Donations; summary by KitchenName (donation item) | the same |
| 4 | Lottery Report | Plaza -> Category (Sales / Redemptions) -> Lottery Type × day: Amount; summary by Lottery Type | Date, Plaza, District Director, Lottery Type |

## Tables and sources (old SQL Server)
| Table | Source | Filter |
|---|---|---|
| POS Order & Ref | `POS_ORDERS` + NetSuiteLocation_Mapping (ROLLOUT Yes or Suspended): per day + store, COUNT(OrderID), **SUM(tax)** | last 2 calendar years + this year (`DATEADD(yy, DATEDIFF(yy,0,GETDATE())-2, 0)` to today) |
| Gift Card | `POS_ORDERDETAILS` + mapping (ROLLOUT Yes only): SUM(valueaddedbaseprice) by department, kitchen name | DepartmentName in (Tim Card, gift cards, Retail - Gift Card, Donations, Gift Card, Instant Tickets, Open Lottery), MenuItemName <> 'Card Fee', same date window |
| Donations | `POS_ORDERDETAILS` + mapping (ROLLOUT Yes only): SUM(valueaddedbaseprice) | DepartmentName = 'Donations' OR MenuItemName = 'Camp Day Bracelet', same date window |
| Paidout & Lottery & Instant Tickets | the two helper queries below, appended (see "Lottery table") | last 2 calendar years + this year |
| Revenue_Append, District, 3640 Utility | as the Sales reports (plaza renames, LB name, 1 hard-coded Newcastle Utility row) | |
| RevenueCenter, DEPTID | old POS mapping tables | not used by the pages (probably) |
| Date | CALENDARAUTO() | |

## Measures
| Measure | Formula (plain English) |
|---|---|
| HST | sum of POS order tax |
| Gift Card | Gift Card rows where department is Gift Card, Retail - gift card, Tim Card or gift cards |
| Lottery | Gift Card rows where department = Open Lottery (helper, not on the pages) |
| Mkt lottery | Market brand, Instant Tickets + Open Lottery (helper) |
| Donations | sum of the Donations table |
| Smille Cookie Donation | refers to the wrong table (sums Gift Card with a Donations filter): not on the pages |
| Sales PY, Sales YOY $ / % | HST one year earlier (DWY − 1, calendar week number): **not on the pages** |
| Lottery Amount (page 4) | column `Amount` of the lottery table, summed by Category and Lottery Type |

## New database mapping
| Old | New (schema master) | QA | DEV |
|---|---|---|---|
| POS_ORDERS.tax | `pos_orders.tax` | yes | yes |
| POS_ORDERDETAILS (DepartmentName, MenuItemName, KitchenName, valueaddedbaseprice) | `pos_order_details` (department_name, menu_item_name, kitchen_name, value_added_base_price) | yes | yes |
| cash paidout (probably POS_ORDERPAIDOUTS) | `pos_order_paid_outs` (menu_item_name, payment_amount) | yes | yes |
| NetSuiteLocation_Mapping, District_Directors | `netsuite_location_mapping`, `district_directors` | **missing** | yes |

## Lottery table (from INFO.EXPRESSIONS, 2026-09-28)
Built from two helper queries that are not loaded on their own:

1. **Open lottery and Instant Tickets**: `POS_ORDERDETAILS` where DepartmentName in ('Instant Tickets', 'Open Lottery'),
   per day, store, department, menu item and order: SUM(valueaddedbaseprice) as Amount. Mapping ROLLOUT Yes or Suspended.
2. **cash paidout**: every row of `POS_ORDERPAIDOUTS` (LEFT JOIN to the mapping), **PaymentAmount × −1** as Amount.
   The typed reason after the ":" in MenuItemName becomes a column "Custom" through ~60 hand-written text rules
   (win -> Winning, lot/lotto/l0tto -> Lottery, instant -> Instant tickets, wrong/mistake -> Error, olg -> Olg,
   anything unmatched -> "Payment Without Reasons"). **Custom is not used on page 4.**

Then, on the combined rows:
| Rule | Category (page 4 level 1) |
|---|---|
| MenuItemName = 'Lottery Redemption' or 'Lottery Payout' | Redemptions |
| DepartmentName = 'Open Lottery' or 'Instant Tickets' | Sales |
| anything else (every paid-out row) | Redemptions |

Lottery Type (page 4 level 2) = DepartmentName, with 'Open Lottery' shown as 'Open lottery' and empty (paid outs) as
'Redemptions'. So on page 4: Sales = Instant Tickets + Open lottery; Redemptions = Open lottery redemptions/payouts from
the order details + all cash paid outs.

**New DB:** `pos_order_details` (department_name, menu_item_name, order_id, value_added_base_price, end_day, store_id)
and `pos_order_paid_outs` (menu_item_name, payment_amount, end_day, store_id). Both are in QA and DEV.

**Question for the business:** cash paid outs are all counted as lottery Redemptions, even ones whose typed reason is
"refund", "error" or blank. Keep that, or only count paid outs whose reason is lottery-related?

## Notes
- The report has no retail calendar, no WTD/PTD/YTD. It is the simplest of the 10.
- A fixed 2-year date window in SQL is not needed in the new engine: the date filter does that.
