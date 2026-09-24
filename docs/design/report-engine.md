# Design: Report Engine website

Status: **DRAFT - waiting for the lead's approval.** No code is written until this is approved.
Ticket: AG-68. Date: 24 Sep 2026.

## 1. The idea in one line

One website that can show **any** report, where each report is a small settings file (a "report spec")
generated from the catalog - instead of hand-building 50 separate reports.

```
Old Power BI report ──(read-only extraction)──▶ catalog DB ──(generator)──▶ report spec file
                                                                                   │
                         Browser (React) ◀── Report Engine API (Java) ◀────────────┘
                                                    │
                                                    ▼
                                       New PostgreSQL DB (read-only user)
```

Adding a report = generate its spec file + review it. No new screens, no new endpoints.

## 2. Decisions already made

| Question | Answer |
|---|---|
| Frontend / backend | React + Java |
| Where it lives | Standalone website |
| Approver | Tech lead |

## 3. Recommended tools (need approval)

| Part | Recommendation | Why |
|---|---|---|
| Frontend | React + TypeScript, built with Vite | Type safety catches mistakes early; Vite is the current standard React build tool |
| UI components | MUI | Already used in the team's other React apps, so no new library to learn |
| Charts | Apache ECharts (`echarts-for-react`) | Free, handles large data, good-looking defaults |
| Tables / grids | TanStack Table | Free; supports grouped rows (Plaza > Brand > Payment Type) |
| Backend | Java 21 + Spring Boot 3 | Matches the team's Java work |
| Database access | Spring `JdbcTemplate` with bind parameters, read-only DB user | Simple, safe, no SQL built from user input |
| Login | Microsoft sign-in (Microsoft Entra ID) via Spring Security | Staff already have company Microsoft accounts |
| Excel export | Apache POI | Standard free Java library for Excel files |
| Caching | Caffeine (in-memory), refreshed daily | The old report refreshes about once a day, so results can be reused |
| Hosting | Azure (App Service or the team's existing Kubernetes) | The database is already on Azure |

Not recommended: AG Grid for the matrix view - its pivot feature is in the paid edition.

## 4. How a report spec looks (example: Tender Report)

```yaml
id: tender-report
title: Tender Report
queries:                       # SQL from reports/tender-report/queries.sql, stored server-side only
  tenders: payment_type_summary
  paidouts: cash_paidout
filters:
  - { id: plaza,             label: Plaza,             type: multi_select, column: plaza }
  - { id: district_director, label: District Director, type: multi_select, column: district_director }
  - { id: brand,             label: Brand,             type: multi_select, column: brand }
  - { id: payment_type,      label: Payment Type,      type: multi_select, column: payment_type }
  - { id: date,              label: Date,              type: date_range,   column: end_day }
visuals:
  - type: table
    title: Selected Locations - Summary
    rows: [payment_type]
    values: [tender_amount, pct_to_total]
  - type: matrix
    title: All Locations - Detail
    rows: [plaza, brand, payment_type]
    columns: [end_day]
    values: [tender_amount]
```

## 5. Mock screen (Tender Report)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Reports ▾   Tender Report                                  Abi  ⎋ Logout │
├──────────────────────────────────────────────────────────────────────────┤
│ Plaza [All ▾]  District Director [All ▾]  Brand [All ▾]  Payment [All ▾]  │
│ Date [2024-12-29] → [2025-01-15]                     [Export to Excel ⬇]  │
├───────────────┬───────────────┬───────────────┬──────────────────────────┤
│ Total tenders │ Cash          │ Card          │ Paid-outs                │
│ $7,572,059    │ $1,047,868    │ $6,524,191    │ $…                       │
├───────────────┴───────────────┴───────────────┴──────────────────────────┤
│ Summary by payment type         │ Detail by day                          │
│ Payment type  Amount    %       │ ▸ Bainsville        $16,254  $14,313 … │
│ Cash          $1.05M    13.8%   │   ▸ Burger King      $4,591   $4,109 … │
│ Debit Card    $2.22M    29.3%   │       Cash             $441     $335 … │
│ Visa          $1.52M    20.0%   │ ▸ Market             $3,578   $2,436 … │
│ …   [bar chart of the same]     │ Total              $619,611 $579,747 … │
└─────────────────────────────────┴────────────────────────────────────────┘
```
Figures are from the old report's PDF, for illustration. The % column shows the corrected share (Debit Card 29.3%);
the old report shows 33.99% - which one the new report shows is decision 3 below.

New compared with the old report: number cards at the top, a chart next to the summary, Excel export,
and one consistent look across all reports.

## 6. Parts to build

**Backend (Java)**
1. `GET /api/reports` - list of reports the user may see.
2. `GET /api/reports/{id}` - the spec (filters and visuals; never the SQL).
3. `POST /api/reports/{id}/data` - runs the report's queries with the chosen filters, returns rows.
4. `GET /api/reports/{id}/export.xlsx` - Excel export.
5. Access rules: which user sees which reports, and optionally which stores (row-level filter added on the server).

**Frontend (React)**
1. Login page (Microsoft sign-in).
2. Report list.
3. One generic report page that draws filters, cards, tables, matrices and charts from the spec.

**Tooling**
1. Spec generator: catalog DB → report spec file.
2. The existing query check (`tests/check_queries.sh`) runs on every spec.

## 7. Database

- Reads the new PostgreSQL DB with a **read-only** user; every session also sets `default_transaction_read_only = on`.
- Recommended: a `reporting` schema holding shared views (for example one cleaned store/brand lookup used by every
  report). AG-66 notes there are no CREATE VIEW rights on dev yet and a reporting schema has been requested.
  Until then the SQL stays in the spec files.
- The catalog stays in its own schema (`catalog`), separate from business data.
- Forward and rollback scripts are paired for every change (`db/migrations/*.sql` + `*.rollback.sql`).

## 8. Security

- The browser never sends SQL. It sends only filter values; the server binds them as parameters.
- Database user can only read.
- Login required for every page and API call.
- No production data is stored in the repo.

## 9. Testing

1. Query check against the new table structure (exists today).
2. **Reconciliation:** for a fixed date range, the new report's totals must equal the old Power BI report's totals.
   This needs data access, which is not possible from the Claude cloud session.
3. Backend unit tests for filters and access rules; a frontend test that the generic page draws each visual type.

## 10. Rollback plan

The website is new and standalone, and only reads data. Rolling back = switching the site off; the old Power BI
reports keep running untouched until the new ones are signed off.

## 11. Phases and rough estimate

Rough, for one developer, to be confirmed by the lead:

| Phase | What | Rough size |
|---|---|---|
| 1 | Engine (backend + generic page + login) and the Tender Report | 3 to 4 weeks |
| 2 | Spec generator + next 5 reports | 1 to 2 weeks |
| 3 | Remaining reports, a few per day once specs generate cleanly | depends on report complexity |

## 12. Decisions needed from the lead

1. Approve the tool choices in section 3.
2. Hosting: Azure App Service or the existing Kubernetes cluster.
3. **% to Total** on the Tender Report: copy the old numbers (which do not add to 100%) or fix them.
4. Do some users see only their own stores (row-level access)?
5. Include the `*_trickle` tables or not.
6. Confirm `CTLOCATION` → `ct_location`, and the Wendy's key fix.
