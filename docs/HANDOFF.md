# Handoff - Power BI -> PostgreSQL report migration (state on 2026-09-28)

Read this first, then `extracts/PLAN.md` (the agreed plan and data rules).

## The user
Abinithi, full stack developer, early career. Plain English, short answers in points, numbered steps, right way vs
wrong way with the reason, official links only, never assume - ask. Tell them where we are / what we need / what is blocked.

## Hard rules
- Repo `Abinithi-Certainti/Reports_Dashboard` is **public**: no real figures, hostnames, IPs, SharePoint links, emails
  or passwords in git. Real data goes in `demo/private-data/` (git-ignored).
- Database: **QA only** (`kios_etl`, schema `master`). SELECT only - never UPDATE/DELETE/INSERT/DROP/ALTER.
  The user may run checks with the QA Read_Write login, SELECT only.
- Never paste or store passwords. The user once pasted DEV passwords in chat - they were told to rotate them.
- Jira: board **AG** only (certainti.atlassian.net). Never touch the production Power BI reports.
- **No mock data** in the demo; data comes from QA; no fixed dates (use whatever days QA holds). A report with no QA
  table shows "No QA data yet".

## Can this session reach the database?
The previous session could NOT: the cloud proxy carries HTTPS only, PostgreSQL (5432) got no response, even after the
user widened network access. **First thing to do in a new session: test it** without credentials:
`timeout 10 pg_isready -h <QA host from .env.example> -p 5432 -t 8`. If it answers, ask the user to put the QA
credentials in a local, git-ignored `.env` (never in chat) - see `.env.example`. If not, keep the CSV route: give the
user a SELECT, they export CSV from QA and attach it.

## The 10 reports
| # | Report | Jira | Stage | Data now |
|---|---|---|---|---|
| 1 | Tender Report | AG-66 | built | mock -> rewrite for QA (`location_code_mappings`) |
| 2 | Detailed Waste Report | - | built | real DEV; `weekly_cogs` not in QA - user to decide keep/remove |
| 3 | Market Category | - | mapped | no QA tables |
| 4 | People Count | - | mapped | no QA tables |
| 5 | Radar Car Count | - | mapped | no QA tables |
| 6 | Sales and Margin with Budget | AG-76 | built | mock; COGS/budget not in QA |
| 7 | Sales Report 1 | AG-79 | built | real QA, store 101518 (= TIM23, plaza 23); labour empty |
| 8 | Sales Report - Budget 2026 | AG-80 | mapped | budget tables not in QA |
| 9 | Sales Report Field Team | AG-81 | mapped | all tables in QA - build next |
| 10 | Financial Reports | AG-82 | built, QA-only SQL | sample rows until the user's QA CSV arrives |
Also: AG-83 = DevOps request for a private repo in the onroute-ca GitHub org + a VM for the demo.

## QA facts (2026-09-28)
- Tables: pos_orders, pos_order_details, pos_order_payments, pos_order_paid_outs (**empty**), employee_pay_summary
  (pay_date is **text**), location_code_mappings (115 stores; description "ONRoute : TIM23 : 23 TIM HORTONS" gives
  location code, plaza number, brand - **no plaza name, host_location_id, district**).
- Missing in QA: netsuite_location_mapping, date_table, district_directors, temp_dlh, weekly_cogs, vena_* budgets,
  people_count, car_count.
- Sales data: 1 store, 2026-09-06 to 2026-09-21.
- Structure file: `demo/private-data/qa_columns_2026-09-28.tsv` (private). Test SQL with
  `NEW_DB_COLUMNS=demo/private-data/qa_columns_2026-09-28.tsv bash tests/check_queries.sh <file>`.

## Links
- Reports demo: https://claude.ai/artifact/MNBSQseP1zwswBm8aZLEhR (build: `npm run build:static` in engine/frontend, Node 20)
- Mapping dashboard: https://claude.ai/artifact/9cVsPmBY37hB1F4Eg6svzm (source `docs/mapping-dashboard.html`)

## Next steps
1. Test database reach (above).
2. Rewrite #1 Tender, #7 Sales Report 1 to QA-only tables; build #9 Field Team (reuse #7, `mtd` window exists).
3. Load the user's QA CSVs into `demo/private-data/*-qa-rows.json`, delete mock rows, republish the demo.
4. Plaza names: a one-off DEV lookup (ct_location -> plaza name) when the user can run DEV (after 10 am).
5. Build #8 (budget part stays empty on QA; `py_fin` window exists).
