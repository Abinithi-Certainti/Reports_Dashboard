-- Facts for the five tech-lead questions.  READ-ONLY: SELECTs only.
-- Run in DBeaver on kios_etl, one query at a time (cursor inside it, Ctrl+Enter). Share the results with the lead.

-- Q1. COGS is 0 on DEV, so GP % shows 100%.
--     Sales and Margin takes COGS from weekly_cogs for the week that holds the sales day (period = week-ending
--     Saturday). If weekly_cogs has no week matching the sales days, COGS is 0 and GP % = (sales - 0) / sales = 100%.
--     1a: which weeks weekly_cogs holds      1b: which days have sales
SELECT period, count(*) AS rows, round(sum(cogs)::numeric, 2) AS cogs
FROM master.weekly_cogs GROUP BY period ORDER BY period;

SELECT end_day::date AS sales_day, count(*) AS orders
FROM master.pos_orders GROUP BY 1 ORDER BY 1;

-- Q2. Repeated vena budget loads.
--     The same budget is loaded several times; every copy is identical except id and timestamps. The reports keep
--     only the newest copy per day / location / brand. This shows how many loads each table holds.
SELECT 'vena_sales' AS budget_table, count(DISTINCT date_trunc('minute', created_timestamp)) AS loads,
       count(*) AS rows, min(created_timestamp) AS first_load, max(created_timestamp) AS last_load FROM master.vena_sales
UNION ALL SELECT 'vena_gross_margin', count(DISTINCT date_trunc('minute', created_timestamp)), count(*),
       min(created_timestamp), max(created_timestamp) FROM master.vena_gross_margin
UNION ALL SELECT 'vena_transactions', count(DISTINCT date_trunc('minute', created_timestamp)), count(*),
       min(created_timestamp), max(created_timestamp) FROM master.vena_transactions
UNION ALL SELECT 'vena_labour_hours', count(DISTINCT date_trunc('minute', created_timestamp)), count(*),
       min(created_timestamp), max(created_timestamp) FROM master.vena_labour_hours;

-- Q3. Are the labour budget rows hourly?
--     Inside one load, one day / location / brand has up to 24 rows with different values. If TimePeriod holds hours
--     (00..23), each row is one hour and adding them up (what the report does) gives the day's hours - correct.
--     3a: what TimePeriod looks like      3b: one busy day / location / brand from the newest load, row by row
SELECT "TimePeriod", count(*) AS rows
FROM master.vena_labour_hours GROUP BY 1 ORDER BY 2 DESC LIMIT 30;

SELECT "TimePeriod_Date", "HostLocationID", "Brand", "TimePeriod", value
FROM master.vena_labour_hours
WHERE created_timestamp = (SELECT max(created_timestamp) FROM master.vena_labour_hours)
  AND ("TimePeriod_Date", "HostLocationID", "Brand") = (
      SELECT "TimePeriod_Date", "HostLocationID", "Brand" FROM master.vena_labour_hours
      WHERE created_timestamp = (SELECT max(created_timestamp) FROM master.vena_labour_hours)
      GROUP BY 1, 2, 3 ORDER BY count(*) DESC LIMIT 1)
ORDER BY "TimePeriod";

-- Q4. Merging STARBUCKS DT.
--     Sales and Margin adds STARBUCKS DT (drive-thru) into STARBUCKS, as the old report did; Sales Report and
--     Budget 2026 keep it separate, as their old reports did. Which plazas have both, and how big each is:
SELECT n.location_name, n.brand_name, count(*) AS orders, round(sum(o.net)::numeric, 2) AS net_sales
FROM master.pos_orders o
JOIN (SELECT DISTINCT store_id, location_name, brand_name FROM master.netsuite_location_mapping) n ON n.store_id = o.store_id
WHERE upper(n.brand_name) LIKE 'STARBUCKS%'
GROUP BY 1, 2 ORDER BY 1, 2;

-- Q5. PLU mapping for Market Category.
--     Market sales by category need "which PLU (till item code) belongs to which category". The old report read it
--     from Net-Chef; no table in the new database has it. This lists any table with a column that looks like it:
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE '%plu%' OR (table_name ILIKE '%plu%') OR (table_name ILIKE '%product%' AND column_name ILIKE '%categ%')
ORDER BY 1, 2, 3;

-- Q5b. Could the new database already link Market sales to categories?
--      Sales lines (pos_order_details.plu) against the COGS product list (weekly_cogs_prod_num.product_num, which has
--      category and sub_category). A high "matched" share means Market Category could show sales by category
--      WITHOUT Net-Chef. Market stores only, as in the report.
WITH market AS (
    SELECT DISTINCT store_id FROM master.netsuite_location_mapping WHERE brand_name ILIKE 'mark%'
), sold AS (
    SELECT d.plu::text AS plu, d.menu_item_name, sum(d.price * d.quantity) AS amount
    FROM master.pos_order_details d JOIN market m ON m.store_id = d.store_id
    GROUP BY 1, 2
), products AS (
    SELECT DISTINCT product_num::text AS product_num, product_name, category FROM master.weekly_cogs_prod_num
)
SELECT count(*)                                                        AS items_sold,
       count(*) FILTER (WHERE p.product_num IS NOT NULL)               AS items_matched_by_code,
       round(100.0 * count(*) FILTER (WHERE p.product_num IS NOT NULL) / nullif(count(*), 0), 1) AS pct_items_matched,
       round(100.0 * sum(s.amount) FILTER (WHERE p.product_num IS NOT NULL) / nullif(sum(s.amount), 0), 1) AS pct_sales_matched
FROM sold s LEFT JOIN products p ON p.product_num = s.plu;

-- Q5c. A few examples side by side (sold item vs product list), to see whether the codes look alike at all
SELECT d.plu, d.menu_item_name, p.product_num, p.product_name, p.category
FROM (SELECT DISTINCT plu::text AS plu, menu_item_name FROM master.pos_order_details
      WHERE store_id IN (SELECT store_id FROM master.netsuite_location_mapping WHERE brand_name ILIKE 'mark%')
      LIMIT 20) d
LEFT JOIN (SELECT DISTINCT product_num::text AS product_num, product_name, category FROM master.weekly_cogs_prod_num) p
       ON p.product_num = d.plu
ORDER BY p.product_num NULLS LAST;
