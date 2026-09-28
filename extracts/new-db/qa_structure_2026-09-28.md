# QA structure vs what the reports need (2026-09-28)

Source: `information_schema.columns` for schema `master` on **QA**, exported by the user on 2026-09-28
(57 tables; the full list is kept outside git in demo/private-data/). Compared with the DEV export of 2026-09-25.

## Tables the reports need
| Table | Used by | DEV | QA |
|---|---|---|---|
| pos_orders | Sales and Margin, Sales Report 1, Budget 2026, Field Team, Market | yes | **yes** |
| pos_order_details | the same + Waste/Market card fees, deposits | yes | **yes** |
| pos_order_payments, pos_order_paid_outs | Tender report | yes | **yes** |
| pos_order_voids | Market | yes | **yes** |
| employee_pay_summary | Sales Report 1, Budget 2026, Field Team (labour) | yes | **yes** (different columns, below) |
| netsuite_location_mapping | **every report** (store -> plaza, brand, host location) | yes | **missing** |
| district_directors | every report (District Director, AGM filter) | yes | **missing** |
| date_table | the retail calendar (every report with WTD/PTD/YTD/PY) | yes | **missing** |
| temp_dlh | labour reports | yes | **missing** |
| weekly_cogs, weekly_cogs_prod_num | Waste, Sales and Margin | yes | **missing** |
| vena_sales, vena_gross_margin, vena_transactions, vena_labour_hours ("Sales", "Transactions", "DLH") | budget reports | yes | **missing** |
| people_count | People Count | yes | **missing** |
| car_count (+ car_count_plaza_direction) | Radar Car Count | yes | **missing** |

## Column differences on the tables both have
| Table.column | DEV | QA |
|---|---|---|
| employee_pay_summary.pay_date | date | **character varying** (text 'YYYY-MM-DD'): cast with `pay_date::date` |
| employee_pay_summary.employee_number | numeric | character varying |
| employee_pay_summary | has pay_period, id, created_by | has pay_amount, retrieve_date, rounded_in_out instead |

## Meaning
- On QA, only **POS and labour facts** exist. Every report also needs the **store mapping** (netsuite_location_mapping)
  to get plaza and brand, and the **retail calendar** (date_table). Without those, no report can group by plaza or brand
  on QA alone.
- Agreed rule (the user, 2026-09-28): a table missing in QA is marked "Missing in QA" and taken from DEV for now.
  So every report today reads POS/labour from QA and the mapping, calendar, budgets, COGS and counts from DEV.
- Two databases cannot be joined in one SQL query. The engine will need either one connection per source, or
  the missing tables copied into QA. **This is a question for the tech lead** (see below).

## Possible QA replacements to check
- `location_code_mappings` (location_code, store_id, brand_guid, description) and `store_pairing_config` exist in
  QA. They might replace part of netsuite_location_mapping, but they have no plaza name, brand name or host location id.

## Questions for the tech lead
1. Will netsuite_location_mapping, district_directors, date_table, temp_dlh, weekly_cogs, the vena budget tables,
   people_count and car_count be loaded into QA? When?
2. Until then, may the report engine read those from DEV while reading POS/labour from QA?
3. Is `location_code_mappings` meant to replace netsuite_location_mapping?

## readonly_user permissions on QA (2026-09-28, has_table_privilege)
- **Cannot read (19):** every business table: pos_orders, pos_order_details, pos_order_payments, pos_order_paid_outs,
  pos_order_taxes, pos_order_voids (+ their _trickle copies), employee_pay_summary, ceridian_employees,
  location_code_mappings, store_pairing_config, invoice_header, invoice_detail, middleware_execution_history.
- **Can read (4):** credentials_reference, file_metadata, flow_definition, system_definition. These are ETL
  configuration tables, not report data. credentials_reference holds key-vault secret names, so this looks like the
  grants are the wrong way round. We do not query it.
- Result: **no report can be run on QA with readonly_user today.** The tech lead needs to grant SELECT on the business
  tables (and review access to credentials_reference).
