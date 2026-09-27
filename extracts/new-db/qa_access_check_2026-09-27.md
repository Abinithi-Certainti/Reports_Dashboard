# QA vs DEV - access check, 2026-09-27

**Correction to the first version of this file.** Nothing changed on QA. The user confirmed that every probe before
2026-09-27 ran on **DEV**. 2026-09-27 is the first time the probes ran on **QA**. The two databases differ.

Login used on QA: `readonly_user`, database `kios_etl`.

## What QA has (2026-09-27)
Probes 15-20 (tools/sales_margin_probe.sql) all failed on QA:
- `master.vena_sales`, `master.vena_gross_margin`, `master.netsuite_location_mapping`, `master.weekly_cogs`: "relation does not exist"
- `master.pos_orders`: "permission denied"

A pg_class lookup (lists every table in the database, whatever the permissions) found:

| Found on QA | Readable by readonly_user |
|---|---|
| pos_orders, pos_order_details, pos_order_paid_outs, pos_order_payments, pos_order_taxes, pos_order_voids | **no** |
| the same six with a `_trickle` suffix | **no** |

**Not in QA under these names, in any schema:** weekly_cogs, vena_sales, vena_gross_margin, "Sales", "Gross Margin",
netsuite_location_mapping, date_table, district_directors.

## What DEV had (2026-09-25)
weekly_cogs, pos_order_details and the structure export (master_columns_2026-09-25.tsv) were all read on DEV.

## Meaning
- Every "QA" result recorded before 2026-09-27 is a **DEV** result: the Waste Report totals, the weekly_cogs vs
  staging match, the car_count / people_count counts and the Market probe.
- QA is behind DEV, or organised differently: several tables are missing, and readonly_user cannot read the POS tables.
- Not checked yet: whether QA holds these tables under other names (a full table list would show it).

## Open questions for the tech lead
1. Which environment should the report migration be validated on, DEV or QA?
2. Will weekly_cogs, the budget tables, netsuite_location_mapping, date_table and district_directors be deployed to QA?
3. Can readonly_user get SELECT on the QA POS tables?
