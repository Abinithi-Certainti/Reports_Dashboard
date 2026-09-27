# QA access check - 2026-09-27

Run by the user on QA (database kios_etl) as `readonly_user` - the same login as on 2026-09-25.

## What changed since 2026-09-25
Probes 15-20 (tools/sales_margin_probe.sql) all failed:
- `master.vena_sales`, `master.vena_gross_margin`, `master.netsuite_location_mapping`, `master.weekly_cogs`: "relation does not exist"
- `master.pos_orders`: "permission denied"

A pg_class lookup (lists every table in the database, whatever the permissions) found:

| Found | Readable by readonly_user |
|---|---|
| pos_orders, pos_order_details, pos_order_paid_outs, pos_order_payments, pos_order_taxes, pos_order_voids | **no** |
| the same six with a `_trickle` suffix (new, not in the 2026-09-25 structure export) | **no** |

**Not found in any schema:** weekly_cogs, vena_sales, vena_gross_margin, "Sales", "Gross Margin",
netsuite_location_mapping, date_table, district_directors.

On 2026-09-25 weekly_cogs and pos_order_details were read successfully by the same login.

## Meaning
- The POS tables exist, but readonly_user lost SELECT on them.
- weekly_cogs, the budget tables, the location mapping and the retail calendar are no longer in the QA database,
  in any schema.
- The cause (QA rebuild, migration in progress, or a permission change) is not known. It is a question for the tech lead.

## Blocks
AG-74 (Waste - weekly_cogs), AG-76 (Sales & Margin - everything), and any new POS probe for AG-73 / AG-75.
