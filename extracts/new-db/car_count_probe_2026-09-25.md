# Car-count tables on QA (kios_etl) - probe results, 2026-09-25

Run by Abinithi with tools/radar_probe.sql (read-only, as readonly_user).

| # | Check | Result |
|---|---|---|
| 1 | Columns like vehicle / volume / zone / class / radar / lane, any schema | only `master.temp_car_count_staging` (zone_id, volume). Others are unrelated (ceridian_employees.pay_class, qrtz_* scheduler). **No vehicle class column anywhere.** |
| 2 | temp_car_count_staging by data_type / status | empty |
| 3 | temp_car_count_staging by plaza / zone | empty |
| 4 | car_count_plaza_direction | 1 row: Port Hope, EB |
| 5 | car_count size | 0 rows |
| 6 | car_count per location | empty |
| 7 | v_vena_car_count_daily_load | 0 rows |

## What it means
- The car-count tables are **built but hold no data on QA**. Neither the radar counts (Radar Car Count, AG-72) nor
  the camera people counts (People Count & Transaction, AG-73) have been loaded into the new database there.
- No table in any schema has a vehicle class, so the Cars / Trucks split in the Radar report has no source yet.
- The direction lookup has 1 of about 21 plazas. Port Hope = EB matches the old hard-coded rule, where EB lanes at
  Port Hope count as **Highway** (passing traffic) - but the column is called `entrance_direction`. Meaning to be
  confirmed before it is used.
- Not checked: DEV and PROD. QA being empty does not prove the other environments are.
