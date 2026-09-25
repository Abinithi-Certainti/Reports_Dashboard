-- Market Category Report (AG-75): read-only checks on QA (kios_etl). Counts and dates only.

-- 13. Is there a PLU -> product mapping anywhere (the old report reads it from Oracle Net-Chef)?
SELECT table_schema, table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS matching_columns
FROM information_schema.columns
WHERE column_name ILIKE ANY (ARRAY['%plu%', '%recipe%', '%product_name_number%', '%product_num%'])
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
GROUP BY table_schema, table_name
ORDER BY 1, 2;

-- 14. Which dates of Market sales does the new pos_order_details hold?
SELECT min(d.end_day)::date AS first_day, max(d.end_day)::date AS last_day, count(*) AS order_lines
FROM master.pos_order_details d
JOIN (SELECT DISTINCT store_id FROM master.netsuite_location_mapping
      WHERE brand_name = 'Market' AND rollout IN ('Yes', 'Suspended')) n ON n.store_id = d.store_id;
