-- Detailed Waste Report dataset: one row per plaza / brand / product / week, from master.weekly_cogs (AG-74).
-- Verified on QA 2026-09-25 (tools/waste_source_check.sql): week 2026-06-27 gives the same rows and totals as the
-- staging table the first prototype read (28,778 rows, COGS 1,659,260.49, theo cost 1,529,415.32).
-- Single statement, no semicolons: the engine wraps it as WITH d AS (...).
WITH loc AS (
    -- same filter as the old WeeklyCogs query: rolled-out locations only, matched on CTLocation
    SELECT DISTINCT ct_location, location_name, brand_name, host_location_id
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL AND rollout IN ('Yes', 'Suspended')
)
SELECT w.period,
       loc.location_name                                    AS plaza,
       upper(replace(loc.brand_name, 'Wendy''s', 'WENDYS')) AS brand,
       dd.district_director,
       p.category,
       p.sub_category,
       concat(w.product_num, '-', p.product_name)           AS item_description,
       w.unit_price,
       w.begin_value,
       w.purchase_value,
       w.var_adj_value,
       w.end_value,
       w.transfer_out_value,
       w.cogs,
       w.theo_cost,
       w.waste_value,
       -- old rule: inventory adjustments count as waste only from the week starting 2023-05-28
       CASE WHEN coalesce(w.start_date, w.period) < date '2023-05-28' THEN 0 ELSE w.inv_adj_value END AS waste_adj_value
FROM master.weekly_cogs w
JOIN loc ON loc.ct_location = w.loc_code
LEFT JOIN master.weekly_cogs_prod_num p ON p.product_num = w.product_num
LEFT JOIN master.district_directors dd ON dd.host_location_id = loc.host_location_id
