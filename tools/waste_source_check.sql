-- AG-74: does master.weekly_cogs hold the same numbers as the staging table? READ-ONLY. Run on QA.
-- One row per source for week 2026-06-27; the two rows should be identical.
SELECT 'weekly_cogs' AS source, count(*) AS rows, count(product_num) AS rows_with_product,
       round(sum(cogs), 2) AS cogs, round(sum(theo_cost), 2) AS theo_cost,
       round(sum(inv_adj_value), 2) AS inv_adj, round(sum(begin_value), 2) AS begin_value
FROM master.weekly_cogs
WHERE period = date '2026-06-27'
UNION ALL
SELECT 'staging (latest load)', count(*), count(parsed_data->>'product_num'),
       round(sum((parsed_data->>'cogs')::numeric), 2), round(sum((parsed_data->>'theo_cost')::numeric), 2),
       round(sum((parsed_data->>'inv_adj_value')::numeric), 2), round(sum((parsed_data->>'begin_value')::numeric), 2)
FROM master.temp_weekly_cogs_staging
WHERE execution_id = (SELECT execution_id FROM master.temp_weekly_cogs_staging ORDER BY created_timestamp DESC LIMIT 1)
