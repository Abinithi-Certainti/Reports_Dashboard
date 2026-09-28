-- Market Category Report dataset (report #3). Source of truth for the old report: extracts/market-category/01_model.md
-- Database: DEV, schema master (extracts/PLAN.md data rule v3). Market brand only: brand_name ILIKE 'mark%'.
-- One row per day, plaza and category (stock rows) or per day, plaza and POS department (sales rows).
-- Every amount column is 0 on rows from the other source, so the measures are plain sums.
--
-- Stock rows = master.weekly_cogs joined to the mapping on ct_location = loc_code, dated on the week-ending Saturday
--              (period). Category / Sub Category come from master.weekly_cogs_prod_num on product_num, the same
--              join as reports/waste-report. Only the value columns already used by the Waste Report on DEV are read.
--              OPEN: the unit columns (BOP U, Receipt U, EOP U, Waste U = begin_quantity, purchase_quantity,
--              end_quantity, waste_quantity, inv_adj_quantity) are in the staging data but not confirmed on
--              master.weekly_cogs - left out until a fresh DEV structure export shows them.
-- Sales rows = master.pos_order_details for Market stores (store_id), same department exclusions as the old query.
--              Sales $ = (value_added_base_price, or price when it is 0) - discount_amount, as the old report.
--              Sales U = count of plu, promotion lines count 0 units, as the old report (quantity is not used).
--              OPEN: needs PLU -> category mapping, no table in the new DB. The old report reached Category through
--              the Net-Chef PLU mapping, so sales rows have NO category / sub category here. They carry the POS
--              department_name instead, which is a different grouping.
--              OPEN: the Sales and Margin report takes Market "Card Fee" and "Alcohol Deposit - Beer" out of sales.
--              The old Market query does not, so they stay in here - to be confirmed.
--
-- Plaza names follow Revenue_Append (same renames as reports/sales-margin-budget). No fixed dates: whatever DEV holds.
-- Checked only against the table structure so far. No semicolons anywhere in this file, comments included.
WITH loc AS (
    SELECT DISTINCT store_id, ct_location, host_location_id, brand_name, location_name
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL AND lower(trim(rollout)) IN ('yes', 'suspended')  -- any case: DEV holds 'yes' too
      AND brand_name ILIKE 'mark%'
), facts AS (
    SELECT w.period::date AS day, l.host_location_id,
           p.category, p.sub_category, NULL::text AS department,
           sum(w.begin_value) AS begin_value, sum(w.purchase_value) AS purchase_value, sum(w.end_value) AS end_value,
           -- old rule: inventory adjustments count as waste only from the week starting 2023-05-28 (a Sunday, so the
           -- week-ending period gives the same weeks as the old Start_Date)
           -- summed apart, like the old DAX (SUM + SUM), so an empty value on one side does not blank the row
           coalesce(sum(w.waste_value), 0)
             + coalesce(sum(CASE WHEN w.period < date '2023-05-28' THEN 0 ELSE w.inv_adj_value END), 0) AS waste_value,
           sum(w.cogs) AS cogs,
           0::numeric AS sales, 0::bigint AS sales_units
    FROM master.weekly_cogs w
    JOIN (SELECT DISTINCT ct_location, host_location_id FROM loc) l ON l.ct_location = w.loc_code
    LEFT JOIN master.weekly_cogs_prod_num p ON p.product_num = w.product_num
    GROUP BY 1, 2, 3, 4, 5
    UNION ALL
    SELECT d.end_day::date, l.host_location_id,
           NULL::text, NULL::text, d.department_name,
           0, 0, 0, 0, 0,
           sum(CASE WHEN d.value_added_base_price = 0 THEN d.price ELSE d.value_added_base_price END - d.discount_amount),
           count(CASE WHEN d.menu_item_name ILIKE '%PROMOTION%' THEN NULL ELSE d.plu END)
    FROM master.pos_order_details d
    JOIN (SELECT DISTINCT store_id, host_location_id FROM loc) l ON l.store_id = d.store_id
    WHERE d.department_name NOT IN ('Instant Tickets', 'Open Lottery', 'Gift Card', 'Retail - Gift Card', 'Gift Cards',
                                    'Donations', 'Notes - Bev', 'Notes - Food', 'Notes', 'Fake Tray')
    GROUP BY 1, 2, 3, 4, 5
), plaza_rename (old_name, new_name) AS (
    VALUES ('New Castle TO S', 'Newcastle'), ('S. Tilbury ON S', 'Tilbury South'), ('N. Tilbury ON S', 'Tilbury North'),
           ('Dutton ON S', 'Dutton'), ('W. Lorne ON S', 'West Lorne'), ('N. Trenton ON S', 'Trenton North'),
           ('S. Trenton ON S', 'Trenton South'), ('Ingleside ON S', 'Ingleside'), ('N. Mallorytown ON S', 'Mallorytown North'),
           ('S. Mallorytown ON S', 'Mallorytown South'), ('Napanee ON S', 'Napanee'), ('Odessa ON S', 'Odessa'),
           ('Port Hope ON S', 'Port Hope'), ('Woodstock ON S', 'Woodstock'), ('Ingersoll TO S', 'Ingersoll'),
           ('King City ON S', 'King City'), ('Maple TO S', 'Maple'), ('N. Cambridge ON S', 'Cambridge North'),
           ('S. Cambridge ON S', 'Cambridge South'), ('Barrie ON S', 'Barrie'), ('Innisfil ON S', 'Innisfil')
), plaza AS (
    -- one plaza name per host location
    SELECT host_location_id, min(trim(location_name)) AS location_name
    FROM loc
    GROUP BY host_location_id
)
SELECT f.day,
       coalesce(r.new_name,
                CASE WHEN trim(replace(p.location_name, 'ON S', '')) IN ('Bainsville', 'Morrisburg')
                     THEN trim(replace(p.location_name, 'ON S', '')) || ' ON S'
                     ELSE trim(replace(p.location_name, 'ON S', '')) END) AS plaza,
       dd.district_director,
       f.category,
       f.sub_category,
       f.department,
       f.begin_value,
       f.purchase_value,
       f.end_value,
       f.waste_value,
       f.cogs,
       f.sales,
       f.sales_units
FROM facts f
LEFT JOIN plaza p ON p.host_location_id = f.host_location_id
LEFT JOIN plaza_rename r ON r.old_name = p.location_name
LEFT JOIN (SELECT host_location_id, min(district_director) AS district_director
           FROM master.district_directors GROUP BY host_location_id) dd ON dd.host_location_id = f.host_location_id
