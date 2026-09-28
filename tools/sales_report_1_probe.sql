-- Sales Report 1 - read-only probes (AG-79, see extracts/sales-report-1/01_model.md).
-- Run ONE query at a time (select it, press F5), and say which database (DEV or QA) the result came from.
-- The PDF's dates are 2026-06-01 to 2026-06-16. Its PY dates are 2025-06-02 to 2025-06-17: the same weekday of the
-- same retail week one retail year earlier (retail 2026 starts 2025-12-28, retail 2025 starts 2024-12-29).

-- Probe 21: does the labour table cover June 2026 and June 2025, and which jobs / pay categories does it hold?
SELECT date_trunc('month', pay_date)::date AS month, pay_category, job, count(*) AS row_count, round(sum(hours), 0) AS hours
FROM master.employee_pay_summary
WHERE pay_date BETWEEN date '2025-06-01' AND date '2025-06-30' OR pay_date BETWEEN date '2026-06-01' AND date '2026-06-30'
GROUP BY 1, 2, 3
ORDER BY 1, 5 DESC;

-- Probe 22: Temp DLH coverage
SELECT min(dlh_date) AS first_day, max(dlh_date) AS last_day, count(*) AS row_count, round(sum(dlh), 0) AS hours
FROM master.temp_dlh;

-- Probe 23: total Sales and Transactions per day, 2026-06-01 to 2026-06-16 (the PDF's page 3 Total row)
WITH loc AS (
    SELECT DISTINCT store_id, brand_name
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL AND rollout IN ('Yes', 'Suspended')
), pos AS (
    SELECT o.end_day::date AS day, sum(o.net) AS net, count(o.order_id) AS transactions
    FROM master.pos_orders o JOIN loc ON loc.store_id = o.store_id
    WHERE o.end_day >= date '2026-06-01' AND o.end_day < date '2026-06-17' AND o.order_type_name::text <> 'Cash Drop'
    GROUP BY 1
), minus AS (
    SELECT d.end_day::date AS day,
           sum(CASE WHEN d.menu_item_name = 'Card Fee' AND loc.brand_name ILIKE 'mark%' THEN d.value_added_base_price ELSE 0 END) AS card_fees,
           sum(CASE WHEN d.department_name = 'Alcohol Deposit - Beer' THEN d.value_added_base_price ELSE 0 END) AS deposits
    FROM master.pos_order_details d JOIN loc ON loc.store_id = d.store_id
    WHERE d.end_day >= date '2026-06-01' AND d.end_day < date '2026-06-17'
      AND (d.menu_item_name = 'Card Fee' OR d.department_name = 'Alcohol Deposit - Beer')
    GROUP BY 1
)
SELECT p.day, round(p.net - coalesce(m.card_fees, 0) - coalesce(m.deposits, 0), 0) AS sales, p.transactions
FROM pos p LEFT JOIN minus m ON m.day = p.day
ORDER BY p.day;

-- Probe 24: is there POS data one retail year earlier (the PY days 2025-06-02 to 2025-06-17)?
SELECT o.end_day::date AS day, round(sum(o.net), 0) AS net, count(*) AS orders
FROM master.pos_orders o
WHERE o.end_day >= date '2025-06-02' AND o.end_day < date '2025-06-18' AND o.order_type_name::text <> 'Cash Drop'
GROUP BY 1
ORDER BY 1;

-- Probe 25: Labour Hours Direct per day, 2026-06-01 to 2026-06-16, with the old report's filters (the PDF's page 6 Total row)
SELECT pay_date, round(sum(hours), 0) AS hours
FROM master.employee_pay_summary
WHERE pay_date BETWEEN date '2026-06-01' AND date '2026-06-16'
  AND location NOT ILIKE '%resource%'
  AND pay_category IN ('OT1.5', 'Reg', 'Hol1.5')
  AND job IN ('CREW MEMBER', 'LEAD', 'SHIFT SUPERVISOR', 'UTILITY')
GROUP BY 1
ORDER BY 1;

-- Probe 26: the daily labour view - does it give the same hours as probe 25?
SELECT "_Date" AS day, "_Account" AS account, round(sum("_Value"), 0) AS value, count(*) AS row_count
FROM master.v_vena_labour_daily_load
WHERE "_Date" BETWEEN date '2026-06-01' AND date '2026-06-16'
GROUP BY 1, 2
ORDER BY 1, 2;

-- Probe 27: the labour location names, so they can be matched to plaza + brand (the old report joins on this text)
SELECT upper(trim(location)) AS location, count(*) AS row_count, round(sum(hours), 0) AS hours
FROM master.employee_pay_summary
WHERE pay_date BETWEEN date '2026-06-01' AND date '2026-06-16'
  AND location NOT ILIKE '%resource%'
GROUP BY 1
ORDER BY 1;
