-- Sales and Margin report with Budget (AG-76). Source of truth for the old report: extracts/sales-margin-budget/01_model.md
-- One row per day, location and brand, per source. Every amount column is 0 on rows from the other sources, so the
-- measures are plain sums.
--
-- Sales $ = POS net (not Cash Drop) - Market "Card Fee" - "Alcohol Deposit - Beer", as the old report does from
-- 2021-08-13 on. Its older sources (GuestCheckHist, POS Order and Ref, the SharePoint lottery file) are not needed.
-- COGS $  = weekly_cogs.cogs, dated on the week-ending Saturday (period), like the old model.
-- Budget  = vena_sales and vena_gross_margin, daily rows. NOT YET CONFIRMED: probe 15 decides whether these or the
--           tables "Sales" and "Gross Margin" hold the budget (tools/sales_margin_probe.sql).
--
-- Brand names are matched after the old report's renames (NYF, MIC, ONCARE, STARBUCKS KIOSK / DT, TIM HORTONS DT,
-- WENDY'S, BURGERKING). The old report replaced text inside names. Here only whole names are replaced, on purpose.
-- Plaza names follow Revenue_Append: its fixed renames, then " ON S" dropped, except Bainsville and Morrisburg.
-- Checked only against the table structure so far. No semicolons anywhere in this file, comments included.
WITH loc AS (
    SELECT DISTINCT store_id, ct_location, host_location_id, brand_name, location_name
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL AND lower(trim(rollout)) IN ('yes', 'suspended')  -- any case: DEV holds 'yes' too (King City TIM03)
), facts AS (
    SELECT o.end_day::date AS day, l.host_location_id, l.brand_name AS brand_raw,
           sum(o.net) AS net_sales, 0::numeric AS card_fees, 0::numeric AS deposits, count(o.order_id) AS transactions,
           0::numeric AS cogs, 0::numeric AS budget_sales, 0::numeric AS budget_gp
    FROM master.pos_orders o
    JOIN loc l ON l.store_id = o.store_id
    WHERE o.order_type_name::text <> 'Cash Drop'
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT d.end_day::date, l.host_location_id, l.brand_name,
           0, sum(d.value_added_base_price), 0, 0, 0, 0, 0
    FROM master.pos_order_details d
    JOIN loc l ON l.store_id = d.store_id
    WHERE d.menu_item_name = 'Card Fee' AND l.brand_name ILIKE 'mark%'
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT d.end_day::date, l.host_location_id, l.brand_name,
           0, 0, sum(d.value_added_base_price), 0, 0, 0, 0
    FROM master.pos_order_details d
    JOIN loc l ON l.store_id = d.store_id
    WHERE d.department_name = 'Alcohol Deposit - Beer'
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT w.period::date, l.host_location_id, l.brand_name,
           0, 0, 0, 0, sum(w.cogs), 0, 0
    FROM master.weekly_cogs w
    JOIN (SELECT DISTINCT ct_location, host_location_id, brand_name FROM loc) l ON l.ct_location = w.loc_code
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT b."TimePeriod_Date", b."HostLocationID", b."Brand",
           0, 0, 0, 0, 0, sum(b.value), 0
    FROM master.vena_sales b
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT g."TimePeriod_Date", g."HostLocationID", g."Brand",
           0, 0, 0, 0, 0, 0, sum(g.value)::numeric
    FROM master.vena_gross_margin g
    GROUP BY 1, 2, 3
), plaza_rename (old_name, new_name) AS (
    VALUES ('New Castle TO S', 'Newcastle'), ('S. Tilbury ON S', 'Tilbury South'), ('N. Tilbury ON S', 'Tilbury North'),
           ('Dutton ON S', 'Dutton'), ('W. Lorne ON S', 'West Lorne'), ('N. Trenton ON S', 'Trenton North'),
           ('S. Trenton ON S', 'Trenton South'), ('Ingleside ON S', 'Ingleside'), ('N. Mallorytown ON S', 'Mallorytown North'),
           ('S. Mallorytown ON S', 'Mallorytown South'), ('Napanee ON S', 'Napanee'), ('Odessa ON S', 'Odessa'),
           ('Port Hope ON S', 'Port Hope'), ('Woodstock ON S', 'Woodstock'), ('Ingersoll TO S', 'Ingersoll'),
           ('King City ON S', 'King City'), ('Maple TO S', 'Maple'), ('N. Cambridge ON S', 'Cambridge North'),
           ('S. Cambridge ON S', 'Cambridge South'), ('Barrie ON S', 'Barrie'), ('Innisfil ON S', 'Innisfil')
), plaza AS (
    -- One plaza name per host location. 4606 (Maple) and 3640 (Newcastle) are the old report's two hard-coded rows.
    SELECT host_location_id, min(location_name) AS location_name
    FROM (SELECT host_location_id, trim(location_name) AS location_name FROM loc
          UNION ALL VALUES (4606, 'Maple'), (3640, 'Newcastle')) x
    GROUP BY host_location_id
), named AS (
    SELECT f.*,
           CASE upper(trim(f.brand_raw))
               WHEN 'NYF' THEN 'NEW YORK FRIES' WHEN 'NY FRIES' THEN 'NEW YORK FRIES'
               WHEN 'MIC' THEN 'ADMIN' WHEN 'ONCARE' THEN 'UTILITY'
               WHEN 'STARBUCKS KIOSK' THEN 'STARBUCKS' WHEN 'STARBUCKS DT' THEN 'STARBUCKS' WHEN 'STARBUX' THEN 'STARBUCKS'
               WHEN 'TIM HORTONS DT' THEN 'TIM HORTONS' WHEN 'TIM HORTON''S' THEN 'TIM HORTONS'
               WHEN 'WENDY''S' THEN 'WENDYS' WHEN 'BURGERKING' THEN 'BURGER KING'
               ELSE upper(trim(f.brand_raw))
           END AS brand,
           coalesce(r.new_name,
                    CASE WHEN trim(replace(p.location_name, 'ON S', '')) IN ('Bainsville', 'Morrisburg')
                         THEN trim(replace(p.location_name, 'ON S', '')) || ' ON S'
                         ELSE trim(replace(p.location_name, 'ON S', '')) END) AS plaza
    FROM facts f
    LEFT JOIN plaza p ON p.host_location_id = f.host_location_id
    LEFT JOIN plaza_rename r ON r.old_name = p.location_name
)
SELECT n.day,
       n.plaza,
       n.brand,
       dd.district_director,
       n.net_sales,
       n.card_fees,
       n.deposits,
       n.net_sales - n.card_fees - n.deposits AS sales,
       n.transactions,
       n.cogs,
       n.budget_sales,
       n.budget_gp
FROM named n
LEFT JOIN (SELECT host_location_id, min(district_director) AS district_director
           FROM master.district_directors GROUP BY host_location_id) dd ON dd.host_location_id = n.host_location_id
