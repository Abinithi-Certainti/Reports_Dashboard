-- Detailed Waste Report dataset - CANDIDATE on master.weekly_cogs (the proper table; AG-74).
-- QA's structure of 2026-09-25 shows weekly_cogs now carries the full detail (product, waste, theo cost, begin...).
-- Replaces dataset.sql (which reads the staging table) once tools/waste_source_check.sql shows both give the same totals.
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
