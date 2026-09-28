-- Sales Report - Including Budget 2026 (AG-80) - read-only probes (see extracts/sales-budget-2026/01_model.md).
-- Run ONE query at a time (select it, press F5). Nothing here writes. Say which database (DEV or QA) each result came from.
-- Each budget has two possible tables in the new DB. These probes show which one matches the old report.

-- Probe B1: sales budget per day, both candidate tables. The old report's all-plaza totals are in the private check file.
SELECT 'vena_sales' AS source_table, "TimePeriod_Date" AS day, round(sum(value)::numeric, 2) AS budget, count(*) AS row_count
FROM master.vena_sales
WHERE "TimePeriod_Date" IN (date '2025-12-28', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
UNION ALL
SELECT 'Sales', "TimePeriod_Date", round(sum(value)::numeric, 2), count(*)
FROM master."Sales"
WHERE "TimePeriod_Date" IN (date '2025-12-28', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
ORDER BY 1, 2;

-- Probe B2: transactions budget per day, both candidate tables
SELECT 'vena_transactions' AS source_table, "TimePeriod_Date" AS day, round(sum(value)::numeric, 0) AS budget, count(*) AS row_count
FROM master.vena_transactions
WHERE "TimePeriod_Date" IN (date '2026-02-01', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
UNION ALL
SELECT 'Transactions', "TimePeriod_Date", round(sum(value)::numeric, 0), count(*)
FROM master."Transactions"
WHERE "TimePeriod_Date" IN (date '2026-02-01', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
ORDER BY 1, 2;

-- Probe B3: labour hours budget per day, all candidate tables
SELECT 'vena_labour_hours' AS source_table, "TimePeriod_Date" AS day, round(sum(value)::numeric, 1) AS budget, count(*) AS row_count
FROM master.vena_labour_hours
WHERE "TimePeriod_Date" IN (date '2026-02-01', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
UNION ALL
SELECT 'DLH', "TimePeriod_Date", round(sum(value)::numeric, 1), count(*)
FROM master."DLH"
WHERE "TimePeriod_Date" IN (date '2026-02-01', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
UNION ALL
SELECT 'vena_labour_hours_dump', "TimePeriod_Date", round(sum(value)::numeric, 1), count(*)
FROM master.vena_labour_hours_dump
WHERE "TimePeriod_Date" IN (date '2026-02-01', date '2026-02-15', date '2026-02-16', date '2026-02-17', date '2026-02-18')
GROUP BY 1, 2
ORDER BY 1, 2;

-- Probe B4: which budget years and dates each table holds
SELECT 'vena_sales' AS source_table, budget_year, min("TimePeriod_Date") AS first_day, max("TimePeriod_Date") AS last_day, count(*) AS row_count FROM master.vena_sales GROUP BY 1, 2
UNION ALL SELECT 'Sales', budget_year, min("TimePeriod_Date"), max("TimePeriod_Date"), count(*) FROM master."Sales" GROUP BY 1, 2
UNION ALL SELECT 'vena_transactions', budget_year, min("TimePeriod_Date"), max("TimePeriod_Date"), count(*) FROM master.vena_transactions GROUP BY 1, 2
UNION ALL SELECT 'Transactions', budget_year, min("TimePeriod_Date"), max("TimePeriod_Date"), count(*) FROM master."Transactions" GROUP BY 1, 2
UNION ALL SELECT 'vena_labour_hours', budget_year, min("TimePeriod_Date"), max("TimePeriod_Date"), count(*) FROM master.vena_labour_hours GROUP BY 1, 2
UNION ALL SELECT 'DLH', budget_year, min("TimePeriod_Date"), max("TimePeriod_Date"), count(*) FROM master."DLH" GROUP BY 1, 2
ORDER BY 1, 2;

-- Probe B5: the brand spellings in the labour budget (the old report renames MIC -> ADMIN, ONCARE -> UTILITY, NYF, WENDY'S, STARBUCKS KIOSK)
SELECT upper(trim("Brand")) AS brand, count(*) AS row_count, round(sum(value)::numeric, 0) AS hours
FROM master.vena_labour_hours
WHERE "TimePeriod_Date" BETWEEN date '2026-02-01' AND date '2026-02-18'
GROUP BY 1
ORDER BY 1;
