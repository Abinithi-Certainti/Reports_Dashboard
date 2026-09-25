-- Radar Car Count (AG-72): what car-count data does the new database hold?
-- READ-ONLY. Every statement is a SELECT that returns counts, dates or lookup rows - no order or sensor detail.
-- Run each block on QA (kios_etl) as readonly_user and send back the results (copy the grid, or save as CSV).

-- 1. Any table, in ANY schema, with vehicle / volume / zone / class columns (the old radar data had these)
SELECT table_schema, table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS matching_columns
FROM information_schema.columns
WHERE column_name ILIKE ANY (ARRAY['%vehicle%', '%volume%', '%zone%', '%class%', '%radar%', '%lane%'])
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
GROUP BY table_schema, table_name
ORDER BY 1, 2;

-- 2. temp_car_count_staging: which kinds of reading, how many, which dates
SELECT data_type, status, count(*) AS readings, min(reading_time) AS first_reading, max(reading_time) AS last_reading
FROM master.temp_car_count_staging
GROUP BY data_type, status
ORDER BY 1, 2;

-- 3. temp_car_count_staging: which plazas and zones exist (zones are how entrance vs highway was told apart)
SELECT plaza_name, zone_id, count(*) AS readings
FROM master.temp_car_count_staging
GROUP BY plaza_name, zone_id
ORDER BY 1, 2;

-- 4. car_count_plaza_direction: the direction lookup (may replace the hard-coded list in the old SQL)
SELECT plaza_name, entrance_direction
FROM master.car_count_plaza_direction
ORDER BY 1;

-- 5. car_count (camera counts): date range and size
SELECT count(*) AS rows, count(DISTINCT location) AS locations, min("timestamp") AS first_time, max("timestamp") AS last_time
FROM master.car_count;

-- 6. v_vena_car_count_daily_load (daily view): date range and size
SELECT count(*) AS rows, min("_Date") AS first_day, max("_Date") AS last_day
FROM master.v_vena_car_count_daily_load;
