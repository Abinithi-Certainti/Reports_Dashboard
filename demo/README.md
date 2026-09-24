# Tender Report demo

A working first version of the report engine, showing the Tender Report.
It runs the real translated SQL, the real business rules and both versions of "% to Total".

**Two ways to run it:**

| Mode | Data | Where |
|---|---|---|
| A. Sample data | Made-up stores and amounts, clearly labelled | Any laptop, no database access needed |
| B. Real DEV data | The new PostgreSQL DEV database, read-only | A laptop that can reach DEV (company network / VPN) |

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

## Try the import (no code change)

1. Open **Import report** in the side menu.
2. Press **Use the example: Paid-outs Report** (or drop the two files from `demo/import-example/paidout-report/`).
3. Press **Check it**, then **Publish**, then **Open report**.

Set `REPORTS_IMPORT_DIR` to choose where uploaded reports are saved (default `./imported-reports`).

## Not in this demo yet

- Microsoft sign-in (needs the company's Azure app registration)
- Excel export
- Per-user data restriction (waiting on decision 4)
