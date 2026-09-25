# Re-check of all reports against QA's structure of 2026-09-25

The structure file extracts/new-db/master_columns.tsv (2026-09-24) is out of date. The fresh export (97 tables,
master + public) is kept in demo/private-data/ (git-ignored) until the repository is private; run checks against it
with `NEW_DB_COLUMNS=demo/private-data/master_columns_2026-09-25.tsv bash tests/check_queries.sh <file>`.

## What changed since the old file
| Change | Matters for |
|---|---|
| **master.weekly_cogs +17 columns**: start_date, product_num, unit_price, begin/purchase/end quantities, begin_value, inv_adj, waste, var_adj, transfer_out, theo_depletion, theo_cost | Waste Report, Market Category |
| **master.date_table** (new): retail_week_of_year, retail_period, retail_year, retail period start/end, start/end of week | Waste Report, Market Category (Retail Year / week filters) |
| temp_weekly_cogs_staging: +26 typed (text) columns next to parsed_data | - |
| netsuite_location_mapping: +location_id_src | - |
| weekly_cogs_bk, weekly_cogs_prod_num_bk (backups) | - |
| public schema: pos_* copies, order_types, flyway_schema_history | - |

## Per report
| Report | Before | Now |
|---|---|---|
| Tender (AG-68) | queries check OK | still OK on the new structure |
| Radar Car Count (AG-72) | blocked: no radar data with vehicle class | **unchanged** - still no vehicle class anywhere |
| People Count (AG-73) | guessed car_count holds the camera counts | **correction**: master.people_count (camera_id, location, timestamp, entrance_count) and master.ip_camera (center) exist - the same names as the old MySQL tables; they were in the old file too and were missed |
| Waste Report (AG-74) | full detail only in staging | weekly_cogs now has it: candidate reports/waste-report/dataset_weekly_cogs.sql; tools/waste_source_check.sql compares both sources. Retail calendar now available |
| Market Category (AG-75) | blocked: PLU -> product mapping | still blocked on the PLU mapping; retail calendar now available |

## Follow-up checks on QA (same day)
- tools/waste_source_check.sql: weekly_cogs and the staging table give **identical** results for week 2026-06-27
  (28,778 rows, all with product, COGS 1,659,260.49, theo cost 1,529,415.32, inv adj 24,682.91, begin 2,882,733.82).
  The Waste Report now reads master.weekly_cogs.
- master.people_count on QA: **0 rows**. The People Count report has no camera data to show yet.
