-- Sales and Margin report with Budget - read-only probes for QA (AG ticket in extracts/sales-margin-budget)
-- Run ONE query at a time in pgAdmin (select it, press F5). Nothing here writes.

-- Probe 15: which schema holds the budget tables, and how many rows each has
SELECT table_schema, table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_name IN ('vena_sales', 'Sales', 'vena_gross_margin', 'Gross Margin')
ORDER BY table_name, table_schema;

-- Probe 16: date range and years in the sales budget (change the table name if probe 15 shows vena_sales is empty)
SELECT budget_year, min("TimePeriod_Date") AS first_day, max("TimePeriod_Date") AS last_day,
       count(*) AS row_count, count(DISTINCT "TimePeriod_Date") AS days, round(sum(value)::numeric, 0) AS total_value
FROM master.vena_sales
GROUP BY budget_year
ORDER BY budget_year;

-- Probe 17: the same for the GM budget
SELECT budget_year, min("TimePeriod_Date") AS first_day, max("TimePeriod_Date") AS last_day,
       count(*) AS row_count, round(sum(value)::numeric, 0) AS total_value
FROM master.vena_gross_margin
GROUP BY budget_year
ORDER BY budget_year;

-- Probe 18: the values the enum order_type_name can take (we must drop 'Cash Drop')
SELECT order_type_name::text AS order_type_name, count(*) AS orders
FROM master.pos_orders
WHERE end_day >= date '2026-09-06' AND end_day < date '2026-09-13'
GROUP BY 1
ORDER BY 2 DESC;

-- Probe 19: week 37 (2026-09-06 to 2026-09-12) all-plaza totals, to compare with the PDF total row
WITH loc AS (
    SELECT DISTINCT store_id, host_location_id, brand_name
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL AND rollout IN ('Yes', 'Suspended')
), pos AS (
    SELECT sum(o.net) AS net, count(o.order_id) AS orders
    FROM master.pos_orders o JOIN loc ON loc.store_id = o.store_id
    WHERE o.end_day >= date '2026-09-06' AND o.end_day < date '2026-09-13'
      AND o.order_type_name::text <> 'Cash Drop'
), fees AS (
    SELECT sum(d.value_added_base_price) AS card_fees
    FROM master.pos_order_details d JOIN loc ON loc.store_id = d.store_id
    WHERE d.end_day >= date '2026-09-06' AND d.end_day < date '2026-09-13'
      AND d.menu_item_name = 'Card Fee' AND loc.brand_name ILIKE 'mark%'
), dep AS (
    SELECT sum(d.value_added_base_price) AS deposits
    FROM master.pos_order_details d JOIN loc ON loc.store_id = d.store_id
    WHERE d.end_day >= date '2026-09-06' AND d.end_day < date '2026-09-13'
      AND d.department_name = 'Alcohol Deposit - Beer'
), bud AS (
    SELECT sum(value) AS sales_budget FROM master.vena_sales
    WHERE "TimePeriod_Date" BETWEEN date '2026-09-06' AND date '2026-09-12'
), gm AS (
    SELECT sum(value) AS gm_budget FROM master.vena_gross_margin
    WHERE "TimePeriod_Date" BETWEEN date '2026-09-06' AND date '2026-09-12'
)
SELECT round(pos.net, 0) AS pos_net, pos.orders, round(fees.card_fees, 0) AS card_fees, round(dep.deposits, 0) AS deposits,
       round(pos.net - coalesce(fees.card_fees, 0) - coalesce(dep.deposits, 0), 0) AS wtd_sales,
       round(bud.sales_budget::numeric, 0) AS wtd_budget_sales, round(gm.gm_budget::numeric, 0) AS wtd_budget_gp
FROM pos, fees, dep, bud, gm;

-- Probe 20: COGS for the same week (weekly_cogs.period is the week-ending Saturday)
SELECT period, round(sum(cogs)::numeric, 0) AS cogs, count(*) AS row_count
FROM master.weekly_cogs
WHERE period BETWEEN date '2026-08-30' AND date '2026-09-19'
GROUP BY period
ORDER BY period;
