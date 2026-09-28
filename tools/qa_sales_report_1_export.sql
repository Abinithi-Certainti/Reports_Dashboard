-- Sales Report 1 on QA (AG-79). READ-ONLY. Run as readonly_user (check with SELECT current_user first).
-- QA has no netsuite_location_mapping and no date_table, so these queries work on store ids and plain dates, and the
-- plaza / brand of the store are filled in by hand. Run ONE query at a time and paste each result.

-- QA-1: which store, which days
SELECT store_id, min(end_day)::date AS first_day, max(end_day)::date AS last_day, count(*) AS orders
FROM master.pos_orders
GROUP BY store_id;

-- QA-2: how pay_date is written (it is text on QA) and which labour locations exist
SELECT pay_date, upper(trim(location)) AS location, job, pay_category, count(*) AS row_count, round(sum(hours), 1) AS hours
FROM master.employee_pay_summary
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2
LIMIT 60;

-- QA-3: daily sales, card fees, deposits and transactions per store (the report's Sales and Transactions)
WITH pos AS (
    SELECT end_day::date AS day, store_id, sum(net) AS net_sales, count(order_id) AS transactions
    FROM master.pos_orders
    WHERE order_type_name::text <> 'Cash Drop'
    GROUP BY 1, 2
), det AS (
    SELECT end_day::date AS day, store_id,
           sum(CASE WHEN menu_item_name = 'Card Fee' THEN value_added_base_price ELSE 0 END) AS card_fees,
           sum(CASE WHEN department_name = 'Alcohol Deposit - Beer' THEN value_added_base_price ELSE 0 END) AS deposits
    FROM master.pos_order_details
    GROUP BY 1, 2
)
SELECT p.day, p.store_id, round(p.net_sales, 2) AS net_sales, round(coalesce(d.card_fees, 0), 2) AS card_fees,
       round(coalesce(d.deposits, 0), 2) AS deposits, p.transactions
FROM pos p
LEFT JOIN det d ON d.day = p.day AND d.store_id = p.store_id
ORDER BY p.day, p.store_id;
