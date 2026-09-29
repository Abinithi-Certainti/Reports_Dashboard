-- Sales Report - Including Budget 2026 (AG-80). Source of truth for the old report: extracts/sales-budget-2026/01_model.md
-- One row per day, location and brand, per source (POS, card fees, deposits, labour, temp labour, 3 budgets). Amount
-- columns are 0 on the other sources' rows, so every measure is a plain sum. Reads the DEV database, schema master.
--
-- Sales        = POS net (not Cash Drop) - Market "Card Fee" (from 2022-04-01) - "Alcohol Deposit - Beer", as AG-79
-- Transactions = number of POS orders (not Cash Drop), as AG-79
-- Labour hours = employee_pay_summary (crew jobs, Reg / OT1.5 / Hol1.5, not HR) + temp_dlh, as AG-79.
--                Both tables are empty on DEV, so labour hours, SPLH and TPLH show 0 or blank there.
--                OPEN: the old report has 5 more location text fixes than AG-79. "A&W" -> "ANW" everywhere is added
--                below. The fixes for MALLORYTOWNNORTH, TRENTONNORTH, TRENTONSOUTH, WESTLORNE and BURGERKING are
--                named in the extract without their target text, so only the AG-79 versions (with " A&W" or the
--                plaza name in front) are here.
-- Sales budget        = vena_sales.value
-- Transactions budget = vena_transactions.value
-- Labour hours budget = vena_labour_hours.value
--   "Sales", "Transactions" and "DLH" are empty on DEV and are not read. vena_sales holds the same budget loaded
--   6 times (400 day, location and brand groups a 7th time, rows differ only in id and timestamps, checked on DEV
--   2026-09-28), so only the latest load per day, location and brand is kept. vena_transactions has the same size
--   and columns, so the same rule is applied (OPEN: not checked row by row). vena_labour_hours is different: see
--   bud_labour below (latest load, its rows added up).
--   Budget brands follow the old clean-up: upper case, NYF -> NEW YORK FRIES, STARBUCKS KIOSK -> STARBUCKS,
--   WENDY'S -> WENDYS, and in the labour budget only MIC -> ADMIN, ONCARE -> UTILITY. Whole names only.
--   OPEN: budget brand spellings not yet compared with the POS brand spellings (probe B5), so a budget brand
--   may show as its own row next to the POS brand.
--   Budget rows join to a plaza on host location only. A host location outside the store mapping (the old
--   report's "Inactive Stores' budget") keeps its budget with an empty plaza. OPEN: keep those rows or leave them out.
--   The old 2022-01-01 -> 2023-01-01 date fix is left out: it does not touch 2026.
-- Retail year, period and week come from master.date_table (the real retail calendar). OPEN: the old budget pages
-- used Excel week number - 1 as the "Retail weeknum", which is not always the real retail week.
-- Last year: DEV holds no last-year sales, so every PY / YOY column is empty on DEV.
-- Brands are NOT merged the way the Sales and Margin report merges them: STARBUCKS DT stays its own brand (AG-79).
-- Checked only against the table structure so far. No semicolons anywhere in this file, comments included.
WITH plaza_rename (old_name, new_name) AS (
    VALUES ('New Castle TO S', 'Newcastle'), ('S. Tilbury ON S', 'Tilbury South'), ('N. Tilbury ON S', 'Tilbury North'),
           ('Dutton ON S', 'Dutton'), ('W. Lorne ON S', 'West Lorne'), ('N. Trenton ON S', 'Trenton North'),
           ('S. Trenton ON S', 'Trenton South'), ('Ingleside ON S', 'Ingleside'), ('N. Mallorytown ON S', 'Mallorytown North'),
           ('S. Mallorytown ON S', 'Mallorytown South'), ('Napanee ON S', 'Napanee'), ('Odessa ON S', 'Odessa'),
           ('Port Hope ON S', 'Port Hope'), ('Woodstock ON S', 'Woodstock'), ('Ingersoll TO S', 'Ingersoll'),
           ('King City ON S', 'King City'), ('Maple TO S', 'Maple'), ('N. Cambridge ON S', 'Cambridge North'),
           ('S. Cambridge ON S', 'Cambridge South'), ('Barrie ON S', 'Barrie'), ('Innisfil ON S', 'Innisfil')
), loc AS (
    SELECT DISTINCT m.store_id, m.host_location_id, trim(m.location_name) AS location_name, m.brand_name,
           coalesce(r.new_name, trim(replace(trim(m.location_name), 'ON S', ''))) AS plaza_base,
           CASE upper(trim(m.brand_name))
               WHEN 'NY FRIES' THEN 'NEW YORK FRIES' WHEN 'STARBUX' THEN 'STARBUCKS'
               WHEN 'TIM HORTON''S' THEN 'TIM HORTONS' WHEN 'TIM H DRIVE THRU' THEN 'TIM HORTONS'
               WHEN 'WENDY''S' THEN 'WENDYS'
               ELSE upper(trim(m.brand_name))
           END AS brand
    FROM master.netsuite_location_mapping m
    LEFT JOIN plaza_rename r ON r.old_name = trim(m.location_name)
    WHERE m.host_location_id IS NOT NULL AND lower(trim(m.rollout)) IN ('yes', 'suspended')  -- any case: DEV holds 'yes' too
), lb AS (
    -- The old report's "LB name": plaza (Bainsville / Morrisburg without " ON S") + space + brand, upper case.
    SELECT DISTINCT host_location_id, brand, upper(plaza_base || ' ' || brand) AS lb_name FROM loc
), bud_sales AS (
    SELECT DISTINCT ON ("TimePeriod_Date", "HostLocationID", "Brand") "TimePeriod_Date", "HostLocationID", "Brand", value
    FROM master.vena_sales
    ORDER BY "TimePeriod_Date", "HostLocationID", "Brand", created_timestamp DESC
), bud_trans AS (
    -- OPEN: same repeated-load check not run on this table yet
    SELECT DISTINCT ON ("TimePeriod_Date", "HostLocationID", "Brand") "TimePeriod_Date", "HostLocationID", "Brand", value
    FROM master.vena_transactions
    ORDER BY "TimePeriod_Date", "HostLocationID", "Brand", created_timestamp DESC
), bud_labour AS (
    -- Checked on DEV 2026-09-29: about 4.27 million rows, 44,044 day / location / brand keys, 14 loads. Inside ONE load a
    -- key has up to 24 rows with different values and nothing else different (location, region, dates, year all the
    -- same) - most likely one row per opening hour, with no hour column. So the rows of the latest load are ADDED UP
    -- (keeping only one would drop real budget hours). Summing per load first also keeps this fast.
    -- OPEN (tech lead): confirm the rows are hourly and that summing them is right.
    SELECT DISTINCT ON ("TimePeriod_Date", "HostLocationID", "Brand") "TimePeriod_Date", "HostLocationID", "Brand", value
    FROM (SELECT "TimePeriod_Date", "HostLocationID", "Brand", created_timestamp, sum(value) AS value
          FROM master.vena_labour_hours
          GROUP BY 1, 2, 3, 4) per_load
    ORDER BY "TimePeriod_Date", "HostLocationID", "Brand", created_timestamp DESC
), budgets AS (
    SELECT b."TimePeriod_Date" AS day, b."HostLocationID"::integer AS host_location_id,
           CASE upper(trim(b."Brand"))
               WHEN 'NYF' THEN 'NEW YORK FRIES' WHEN 'STARBUCKS KIOSK' THEN 'STARBUCKS' WHEN 'WENDY''S' THEN 'WENDYS'
               ELSE upper(trim(b."Brand")) END AS brand,
           b.value::numeric AS budget_sales, 0::numeric AS budget_transactions, 0::numeric AS budget_labour_hours
    FROM bud_sales b
    UNION ALL
    SELECT t."TimePeriod_Date", t."HostLocationID"::integer,
           CASE upper(trim(t."Brand"))
               WHEN 'NYF' THEN 'NEW YORK FRIES' WHEN 'STARBUCKS KIOSK' THEN 'STARBUCKS' WHEN 'WENDY''S' THEN 'WENDYS'
               ELSE upper(trim(t."Brand")) END,
           0, t.value::numeric, 0
    FROM bud_trans t
    UNION ALL
    SELECT h."TimePeriod_Date", h."HostLocationID"::integer,
           CASE upper(trim(h."Brand"))
               WHEN 'NYF' THEN 'NEW YORK FRIES' WHEN 'STARBUCKS KIOSK' THEN 'STARBUCKS' WHEN 'WENDY''S' THEN 'WENDYS'
               WHEN 'MIC' THEN 'ADMIN' WHEN 'ONCARE' THEN 'UTILITY'
               ELSE upper(trim(h."Brand")) END,
           0, 0, h.value::numeric
    FROM bud_labour h
), facts AS (
    SELECT o.end_day::date AS day, l.host_location_id,
           CASE WHEN o.order_type_name::text = 'Drive-Thru' AND l.location_name = 'Maple' AND l.brand_name = 'Tim Hortons'
                THEN 'TIM HORTONS DT' ELSE l.brand END AS brand,
           sum(o.net) AS net_sales, 0::numeric AS card_fees, 0::numeric AS deposits, count(o.order_id) AS transactions,
           0::numeric AS labour_hours, 0::numeric AS budget_sales, 0::numeric AS budget_transactions,
           0::numeric AS budget_labour_hours
    FROM master.pos_orders o
    JOIN loc l ON l.store_id = o.store_id
    WHERE o.order_type_name::text <> 'Cash Drop'
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT d.end_day::date, l.host_location_id, l.brand, 0, sum(d.value_added_base_price), 0, 0, 0, 0, 0, 0
    FROM master.pos_order_details d
    JOIN loc l ON l.store_id = d.store_id
    WHERE d.menu_item_name = 'Card Fee' AND l.brand_name ILIKE 'mark%' AND d.end_day > timestamp '2022-04-01 00:15:00'
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT d.end_day::date, l.host_location_id, l.brand, 0, 0, sum(d.value_added_base_price), 0, 0, 0, 0, 0
    FROM master.pos_order_details d
    JOIN loc l ON l.store_id = d.store_id
    WHERE d.department_name = 'Alcohol Deposit - Beer'
    GROUP BY 1, 2, 3
    UNION ALL
    -- Labour: empty on DEV, so these rows add nothing there.
    SELECT p.pay_date::date, lb.host_location_id, lb.brand, 0, 0, 0, 0, sum(p.hours), 0, 0, 0
    FROM master.employee_pay_summary p
    JOIN lb ON lb.lb_name =
        replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
            upper(trim(p.location)), 'TRAVEL PLAZA ', ''), ' ONSITE', ''), 'NYF', 'NEW YORK FRIES'), 'DDT', 'DT'),
            'MALLORYTOWN SOUTH BRAND 6', 'MALLORYTOWN SOUTH ANW'), 'TRENTONSOUTH A&W', 'TRENTON SOUTH ANW'),
            'DUTTON A&W', 'DUTTON ANW'), 'WESTLORNE A&W', 'WEST LORNE ANW'), 'TRENTONNORTH A&W', 'TRENTON NORTH ANW'),
            'MALLORYTOWNNORTH A&W', 'MALLORYTOWN NORTH ANW'), 'PORTHOPE BOOSTERJUICE', 'PORT HOPE BOOSTER JUICE'),
            'INGERSOLL BURGERKING', 'INGERSOLL BURGER KING'), 'NEWCASTLE BURGERKING', 'NEWCASTLE BURGER KING'),
            'A&W', 'ANW')
    WHERE p.location NOT ILIKE '%resource%'
      AND p.pay_category IN ('OT1.5', 'Reg', 'Hol1.5')
      AND p.job IN ('CREW MEMBER', 'LEAD', 'SHIFT SUPERVISOR', 'UTILITY')
    GROUP BY 1, 2, 3
    UNION ALL
    -- Temp labour: empty on DEV, so these rows add nothing there.
    SELECT t.dlh_date, lb.host_location_id, lb.brand, 0, 0, 0, 0, sum(t.dlh), 0, 0, 0
    FROM master.temp_dlh t
    JOIN lb ON lb.lb_name = upper(trim(t.plaza) || ' ' || trim(t.brand))
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT b.day, b.host_location_id, b.brand, 0, 0, 0, 0, 0,
           sum(b.budget_sales), sum(b.budget_transactions), sum(b.budget_labour_hours)
    FROM budgets b
    GROUP BY 1, 2, 3
), plaza AS (
    -- One plaza per host location. 4606 (Maple) and 3640 (Newcastle) are the old report's two hard-coded rows.
    SELECT host_location_id, min(plaza_base) AS plaza_base
    FROM (SELECT host_location_id, plaza_base FROM loc UNION ALL VALUES (4606, 'Maple'), (3640, 'Newcastle')) x
    GROUP BY host_location_id
)
SELECT f.day,
       trim(dt.weekday)                                              AS weekday,
       dt.day_of_week                                                AS weekday_no,
       dt.end_of_week                                                AS week_end,
       dt.retail_year,
       dt.retail_period,
       dt.retail_week_of_year                                        AS retail_week,
       CASE WHEN p.plaza_base IN ('Bainsville', 'Morrisburg') THEN p.plaza_base || ' ON S' ELSE p.plaza_base END AS plaza,
       f.brand,
       dd.district_director,
       CASE WHEN f.host_location_id IN (4630, 4788, 4586, 3781, 3780, 3640, 4292, 4606) THEN 'Central'
            WHEN f.host_location_id IN (3786, 4282, 4284, 4286, 3785, 4288, 4290, 3784, 4280) THEN 'East'
            WHEN f.host_location_id IN (4626, 4628, 3782, 4566, 3783, 4294) THEN 'West'
            ELSE 'TBD' END                                           AS agm,
       f.net_sales,
       f.card_fees,
       f.deposits,
       f.net_sales - f.card_fees - f.deposits                        AS sales,
       f.transactions,
       f.labour_hours,
       f.budget_sales,
       f.budget_transactions,
       f.budget_labour_hours
FROM facts f
LEFT JOIN plaza p ON p.host_location_id = f.host_location_id
LEFT JOIN master.date_table dt ON dt.date = f.day
LEFT JOIN (SELECT host_location_id, min(district_director) AS district_director
           FROM master.district_directors GROUP BY host_location_id) dd ON dd.host_location_id = f.host_location_id
