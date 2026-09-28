-- One-off DEV lookup: location code (ct_location, e.g. TIM23) -> plaza name, host location id, district director.
-- Why: QA location_code_mappings gives store -> location code, plaza number and brand, but no plaza name,
-- host_location_id or district. This fills that gap once, as a small seed table.
-- READ-ONLY: a single SELECT. Run it on DEV (kios_etl, schema master), save the result as CSV and attach it in the
-- chat. The CSV holds real names: it goes to demo/private-data/, never into git. Never paste a password in the chat.
-- plaza_number = the digits in ct_location (TIM23 -> 23), the same number QA shows in location_code_mappings.
-- names_found > 1 means DEV has more than one plaza name for that code: those rows need a human decision.
SELECT m.ct_location,
       substring(m.ct_location FROM '[0-9]+')                                AS plaza_number,
       min(trim(m.location_name))                                            AS plaza_name,
       count(DISTINCT trim(m.location_name))                                 AS names_found,
       string_agg(DISTINCT trim(m.location_name), ' | ')                     AS all_names,
       string_agg(DISTINCT m.host_location_id::text, ' | ')                  AS host_location_id,
       string_agg(DISTINCT trim(m.brand_name), ' | ')                        AS brand_name,
       string_agg(DISTINCT m.rollout, ' | ')                                 AS rollout,
       string_agg(DISTINCT dd.district, ' | ')                               AS district,
       string_agg(DISTINCT dd.district_director, ' | ')                      AS district_director
FROM master.netsuite_location_mapping m
LEFT JOIN master.district_directors dd ON dd.host_location_id = m.host_location_id
WHERE m.ct_location IS NOT NULL
GROUP BY m.ct_location
ORDER BY plaza_number, m.ct_location
