-- Made-up rows for tests/check_windows_e2e.sh. Loaded into a throwaway local database built from the new DB's
-- structure (never a real database). The numbers are chosen so every expected total can be worked out by hand.
-- Retail year 2026 starts Sunday 2025-12-28. Week 37 = 2026-09-06 to 2026-09-12. Period 9 starts 2026-08-23.
INSERT INTO master.date_table (date, start_of_week, end_of_week, retail_week_of_year, retail_period, retail_year,
                               retail_period_start_date, retail_period_end_date)
SELECT d::date, d::date - ((d::date - date '2025-12-28') % 7), d::date - ((d::date - date '2025-12-28') % 7) + 6,
       w, p, 2026, date '2025-12-28' + 7 * (ps - 1), NULL
FROM generate_series(date '2025-12-28', date '2026-12-26', interval '1 day') d,
     LATERAL (SELECT (d::date - date '2025-12-28') / 7 + 1 AS w) wk,
     LATERAL (SELECT CASE WHEN w <= 4 THEN 1 WHEN w <= 8 THEN 2 WHEN w <= 13 THEN 3 WHEN w <= 17 THEN 4 WHEN w <= 21 THEN 5
                          WHEN w <= 26 THEN 6 WHEN w <= 30 THEN 7 WHEN w <= 34 THEN 8 WHEN w <= 39 THEN 9 WHEN w <= 43 THEN 10
                          WHEN w <= 47 THEN 11 ELSE 12 END AS p) per,
     LATERAL (SELECT CASE p WHEN 1 THEN 1 WHEN 2 THEN 5 WHEN 3 THEN 9 WHEN 4 THEN 14 WHEN 5 THEN 18 WHEN 6 THEN 22 WHEN 7 THEN 27
                            WHEN 8 THEN 31 WHEN 9 THEN 35 WHEN 10 THEN 40 WHEN 11 THEN 44 ELSE 48 END AS ps) pstart;

INSERT INTO master.netsuite_location_mapping (store_id, ct_location, host_location_id, brand_name, location_name, rollout) VALUES
  ('S1', 'C1', 101, 'Tim Hortons DT', 'N. Cambridge ON S', 'Yes'),
  ('S2', 'C2', 102, 'Market', 'Bainsville', 'Yes'),
  ('S3', 'C3', 103, 'Wendy''s', 'Closed ON S', 'No');
INSERT INTO master.district_directors (host_location_id, plaza, district_director) VALUES (101, 'x', 'DD A'), (102, 'y', 'DD B');

-- Every day to 2026-09-12: S1 sells 100, S2 sells 50, S3 (not rolled out) 1000. Each also has a Cash Drop of 999.
INSERT INTO master.pos_orders (order_id, store_id, end_day, net, order_type_name)
SELECT row_number() OVER (), s.store_id, d, s.net, t
FROM generate_series(timestamp '2025-12-28 10:00', timestamp '2026-09-12 10:00', interval '1 day') d,
     (VALUES ('S1', 100), ('S2', 50), ('S3', 1000)) s(store_id, net),
     (VALUES ('Dine In'), ('Cash Drop')) o(t);
UPDATE master.pos_orders SET net = 999 WHERE order_type_name = 'Cash Drop';

-- S2 (Market) pays a card fee of 1 and a beer deposit of 2 a day. The fee rule only counts Market brands.
INSERT INTO master.pos_order_details (store_id, end_day, menu_item_name, department_name, value_added_base_price)
SELECT s, d, m, dep, v
FROM generate_series(timestamp '2025-12-28 10:00', timestamp '2026-09-12 10:00', interval '1 day') d,
     (VALUES ('S2', 'Card Fee', 'Fees', 1), ('S2', 'Beer', 'Alcohol Deposit - Beer', 2), ('S1', 'Card Fee', 'Fees', 5)) x(s, m, dep, v);

-- COGS on every Saturday: C1 210, C2 70.
INSERT INTO master.weekly_cogs (loc_code, period, cogs)
SELECT c, d::date, v
FROM generate_series(date '2026-01-03', date '2026-09-12', interval '7 days') d, (VALUES ('C1', 210), ('C2', 70)) x(c, v);

-- Daily budget: 101 sells 90 (GM 60), 102 sells 45 (GM 30). The brand is written the way the budget files write it.
INSERT INTO master.vena_sales ("TimePeriod_Date", "HostLocationID", "Brand", value)
SELECT d::date, h, b, v FROM generate_series(date '2025-12-28', date '2026-12-26', interval '1 day') d,
     (VALUES (101, 'TIM HORTONS DT', 90), (102, 'Market', 45)) x(h, b, v);
INSERT INTO master.vena_gross_margin ("TimePeriod_Date", "HostLocationID", "Brand", value)
SELECT d::date, h, b, v FROM generate_series(date '2025-12-28', date '2026-12-26', interval '1 day') d,
     (VALUES (101, 'TIM HORTONS DT', 60), (102, 'Market', 30)) x(h, b, v);
