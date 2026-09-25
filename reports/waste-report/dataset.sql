-- Detailed Waste Report dataset: one row per plaza / brand / product / week, from the new PostgreSQL model.
-- PROTOTYPE SOURCE: the full detail currently exists only in master.temp_weekly_cogs_staging.parsed_data (jsonb) -
-- master.weekly_cogs keeps just cogs / end_value / purchase_value and no product (AG-74, decision pending).
-- The same week can be loaded more than once (QA: 3 identical loads of 2026-06-27), so only the LATEST load of each
-- week is read - otherwise every number is multiplied by the number of loads.
-- Single statement, no semicolons: the engine wraps it as WITH d AS (...).
WITH latest_load AS (
    SELECT DISTINCT ON (s.parsed_data->>'period') s.parsed_data->>'period' AS period_text, s.execution_id
    FROM master.temp_weekly_cogs_staging s
    ORDER BY s.parsed_data->>'period', s.created_timestamp DESC
), cogs AS (
    SELECT s.parsed_data AS j
    FROM master.temp_weekly_cogs_staging s
    JOIN latest_load l ON l.execution_id = s.execution_id AND l.period_text = s.parsed_data->>'period'
), loc AS (
    -- same filter as the old WeeklyCogs query: rolled-out locations only, matched on CTLocation
    SELECT DISTINCT ct_location, location_name, brand_name, host_location_id
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL AND rollout IN ('Yes', 'Suspended')
)
SELECT to_date(c.j->>'period', 'MM-DD-YYYY')                     AS period,
       loc.location_name                                          AS plaza,
       upper(replace(loc.brand_name, 'Wendy''s', 'WENDYS'))       AS brand,
       dd.district_director,
       c.j->>'category'                                           AS category,
       c.j->>'sub_category'                                       AS sub_category,
       concat(c.j->>'product_num', '-', c.j->>'product_name')     AS item_description,
       (c.j->>'unit_price')::numeric                              AS unit_price,
       (c.j->>'begin_value')::numeric                             AS begin_value,
       (c.j->>'purchase_value')::numeric                          AS purchase_value,
       (c.j->>'var_adj_value')::numeric                           AS var_adj_value,
       (c.j->>'end_value')::numeric                               AS end_value,
       (c.j->>'transfer_out_value')::numeric                      AS transfer_out_value,
       (c.j->>'cogs')::numeric                                    AS cogs,
       (c.j->>'theo_cost')::numeric                               AS theo_cost,
       (c.j->>'waste_value')::numeric                             AS waste_value,
       -- old rule: inventory adjustments count as waste only from the week starting 2023-05-28
       CASE WHEN to_date(c.j->>'period', 'MM-DD-YYYY') < date '2023-05-28' THEN 0
            ELSE (c.j->>'inv_adj_value')::numeric END             AS waste_adj_value
FROM cogs c
JOIN loc ON loc.ct_location = c.j->>'loc_code'
LEFT JOIN master.district_directors dd ON dd.host_location_id = loc.host_location_id
