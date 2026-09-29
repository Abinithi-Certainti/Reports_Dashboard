# Tender Report demo

A working first version of the report engine, showing the Tender Report.
It runs the real translated SQL, the real business rules and both versions of "% to Total".

**Two ways to run it:**

| Mode | Data | Where |
|---|---|---|
| A. Sample data | Made-up stores and amounts, clearly labelled | Any laptop, no database access needed |
| B. Real DEV data | The new PostgreSQL DEV database, read-only | A laptop that can reach DEV (company network / VPN) |

## Where the numbers come from - picked automatically

The dashboard decides at start-up, then per report, and says which on every page (sidebar dot, status chip, banner):

| Order | Source | Used when | Shown as |
|---|---|---|---|
| 1 | **Live DEV** - the Java backend (`/api/...`) | `GET /api/health` answers `{"database":"up"}` within 3 s (the backend runs **and** its `SELECT 1` works) | green "Live DEV data" |
| 2 | **DEV export** - `demo/private-data/<report id>.json` in the browser | no live DEV, and that report's export file exists | blue "DEV export" + export date / row-limit warning |
| 3 | **Sample** - rows generated in the browser (`src/static/sampleData.ts`) | no live DEV and no export for that report | orange "Sample data - made up" banner |

- The health check fails over on any error, an HTTP 503 `{"database":"down"}`, or no answer within 3 s. It runs once
  per page load; reload the page after starting the backend.
- Offline, every report is answered by `src/static/staticApi.ts` (same filters, windows and % to Total as the engine).
- Sample rows use the last ~60 days up to today (plus the same days a year earlier for the PY columns), the repo's
  plaza / brand / payment type names, and "District A/B/C" as district directors. The numbers mean nothing.
- Reports 4 and 5 (People Count, Radar Car Count) stay "Cannot show yet": there is no data for them anywhere.

## What you need installed

- Java 21 and Maven 3.9 (`java -version`, `mvn -v`)
- Node.js 20 or newer (`node -v`)
- For mode A only: PostgreSQL 16 on your laptop
- On Windows, run the `.sh` scripts from **Git Bash**

## Mode A - sample data

1. Start a local PostgreSQL and build the demo database:
   ```bash
   bash db/setup-local.sh          # starts a local PostgreSQL on port 5434 and builds the catalog
   bash demo/setup-demo-db.sh      # creates tender_demo with the new table structure + SAMPLE data
   ```
2. Start the backend (new terminal):
   ```bash
   cd engine/backend
   mvn -q package
   PG_HOST=localhost PG_PORT=5434 PG_NAME=tender_demo PG_USERNAME=postgres \
   SAMPLE_DATA_NOTICE="All stores, names and amounts on this page are made up." \
   java -jar target/report-engine-0.1.0-SNAPSHOT.jar
   ```
3. Start the frontend (another terminal):
   ```bash
   cd engine/frontend
   npm install
   npm run dev
   ```
4. Open <http://localhost:5173/#/tender-report>

## Mode B - real DEV data (read-only)

Same as mode A, but skip step 1 and start the backend against DEV instead.
Use the **read-only** login, never an admin or application login.

```bash
cd engine/backend
mvn -q package
PG_HOST=<dev host> PG_PORT=5432 PG_NAME=kios_etl PG_USERNAME=<read-only user> PG_PASSWORD=<password> \
PG_URL_PARAMS='?sslmode=require' \
java -jar target/report-engine-0.1.0-SNAPSHOT.jar
```

- Right way: type the password into your own terminal (or your IDE's run settings). It stays on your laptop.
- Wrong way: putting the password into a file in this repo. `.gitignore` blocks `.env`, but a password in any
  other committed file would be exposed to everyone with access.

Every database connection is forced read-only (`default_transaction_read_only = on`), on top of the read-only user.

Note from AG-66: DEV holds only 4 stores in `pos_orders`, so DEV totals will not match production.
Reconciling against the production Power BI report needs production-like data.

## What to look at in the demo

1. **Filters** - Plaza, District Director, Brand, Payment Type, date range. Everything on the page follows them.
2. **Number cards** - total, cash after paid-outs, card and other, paid-outs.
3. **Summary table** - with the **"% to Total" toggle**:
   - *As in Power BI today*: reproduces the current report exactly (checked against the real PDF numbers in
     `engine/backend/src/test/.../CalculationsTest.java`). Does not add up to 100%.
   - *Corrected*: adds up to 100%.
   This is decision 3 in `docs/design/report-engine.md`.
4. **Bar chart** of the same summary.
5. **Detail grid** - Plaza > Brand > Payment Type by day, expand/collapse, sticky first column, totals.

## Not in this demo yet

- Microsoft sign-in (needs the company's Azure app registration)
- Excel export
- Per-user data restriction (waiting on decision 4)

## Online copy (no server) - DEV exports, else sample rows

One HTML file that runs the dashboard inside the browser: `npm run build:static` skips the health check and starts in
modes 2 / 3 above straight away. A report with a DEV export shows it; the others show clearly labelled sample rows.

1. Regenerate the export queries after any `dataset.sql` change: `bash tools/make_dev_exports.sh`.
2. Run `tools/dev_export/<report>.sql` on DEV and save the **whole** result (not only the rows shown on screen) as
   `demo/private-data/dev_<report>.csv`.
3. Convert it: `python3 tools/private_to_json.py <report> demo/private-data/dev_<report>.csv`. It writes
   `demo/private-data/<report>.json` and warns when the file has exactly 20,000 rows (a cut-off export).
4. Build: `cd engine/frontend && npm ci && npm run build:static` - writes `dist-static/index.html`.

- `demo/private-data/` is git-ignored: the repository is public, so real figures never go into git. Both builds
  (`dist/` and `dist-static/index.html`) contain the exports too - both are git-ignored; share them only privately.
- Live mode (Mode B above) needs no exports: the backend reads every report straight from DEV.
