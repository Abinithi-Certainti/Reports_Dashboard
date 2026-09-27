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

## Decision (2026-09-27, the user)
The team chooses the database: whichever of DEV or QA has enough data for a report is the one we use. This is not
a question for the tech lead. Every result must record which database it came from. Scope: 10 reports, prioritised
by the business team.

## Sales Report 1 tables on QA (2026-09-27, pg_class lookup as readonly_user)
| Table | On QA | approx_rows | readonly_user can read |
|---|---|---|---|
| employee_pay_summary | yes | 68,666 | no |
| pos_order_details | yes | 89,310 | no |
| pos_orders | yes | 18,649 | no |
| temp_dlh, v_vena_labour_daily_load, netsuite_location_mapping, district_directors, date_table | **not found** | | |

Decision: the report is NOT checked on QA with a read-write login. Read-only access stays the rule. The way forward is
SELECT for readonly_user (granted by whoever owns QA), or DEV.

## QA coverage (2026-09-27) - run with the READ-WRITE login, not readonly_user
The user ran these checks as `developer_access` (connection kios_etl_Read_Write). They were read-only SELECTs, but the
agreed rule is readonly_user only, so no further checks are run with that login.
- pos_orders: 2026-09-06 to 2026-09-21, 18,649 orders, 16 days, **1 store only**
- pos_order_details: 2026-09-06 to 2026-09-21, 89,368 lines, 16 days
- employee_pay_summary: **pay_date is text (character varying) on QA**, but a date on DEV. date_trunc failed on it.

Meaning: QA holds a small test load (one store, two weeks). It cannot reproduce the PDF (2026-06-01 to 06-16, all
stores), and its column types differ from DEV. DEV stays the database for Sales Report 1.
