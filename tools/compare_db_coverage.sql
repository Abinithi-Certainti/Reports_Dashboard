-- QA vs DEV comparison, part 2 of 2: what DATA the report tables hold - exact rows, first and last day, number of
-- stores. A table missing in that database shows exists = false (it is skipped, so the query does not fail).
-- READ-ONLY: a single SELECT (query_to_xml only runs the read-only SELECTs written below).
-- Run it on QA and on DEV, save each result as CSV: qa_coverage.csv and dev_coverage.csv -> attach both.
-- On DEV the big tables can take a minute or two: that is normal.
SELECT t.table_name,
       to_regclass('master.' || t.table_name) IS NOT NULL                       AS exists,
       x.rows, x.first_day, x.last_day, x.stores
FROM (VALUES ('pos_orders', 'end_day', 'store_id'),
             ('pos_order_details', 'end_day', 'store_id'),
             ('pos_order_payments', 'end_day', 'store_id'),
             ('pos_order_paid_outs', 'end_day', 'store_id'),
             ('pos_order_voids', 'end_day', 'store_id'),
             ('employee_pay_summary', 'pay_date', 'location'),
             ('location_code_mappings', NULL, 'store_id'),
             ('netsuite_location_mapping', NULL, 'store_id'),
             ('district_directors', NULL, 'host_location_id'),
             ('date_table', 'date', NULL),
             ('temp_dlh', 'dlh_date', 'plaza'),
             ('weekly_cogs', NULL, NULL),
             ('people_count', NULL, NULL),
             ('car_count', NULL, NULL)) AS t(table_name, day_col, store_col)
LEFT JOIN LATERAL (
    SELECT (xpath('/row/rows/text()',  r))[1]::text::bigint AS rows,
           (xpath('/row/f/text()',     r))[1]::text         AS first_day,
           (xpath('/row/l/text()',     r))[1]::text         AS last_day,
           (xpath('/row/stores/text()', r))[1]::text::bigint AS stores
    FROM (SELECT query_to_xml(format(
              'SELECT count(*) AS rows, %s AS f, %s AS l, %s AS stores FROM master.%I',
              CASE WHEN t.day_col IS NULL THEN 'NULL' ELSE format('min(%I::text)', t.day_col) END,
              CASE WHEN t.day_col IS NULL THEN 'NULL' ELSE format('max(%I::text)', t.day_col) END,
              CASE WHEN t.store_col IS NULL THEN 'NULL' ELSE format('count(DISTINCT %I)', t.store_col) END,
              t.table_name), false, true, '') AS r
          WHERE to_regclass('master.' || t.table_name) IS NOT NULL) q
) x ON true
ORDER BY t.table_name
