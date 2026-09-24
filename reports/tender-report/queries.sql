-- Tender Report: source queries translated from SQL Server (dbo) to PostgreSQL (master).
-- One query per model table, same shape as the old report, with the Power Query steps folded into SQL.
-- Old SQL and steps: extracts/tender-report/05_sources.md.  Column mapping: db/seeds/002_tender_report_column_map.sql.
--
-- STATUS: checked for syntax and column names against an empty copy of the new tables. NOT yet checked
-- against real data: no data access from this environment. Numbers must be reconciled before use.
--
-- DELIBERATE DIFFERENCES FROM THE OLD REPORT (pending approval):
--   D1. cash_paidout.lb_name now gets the same "Wendy's" -> "WENDYS" fix as the other keys, so paid-outs for that
--       brand link to their store (finding: possible key mismatch). Everything else reproduces the old behaviour,
--       including the % to Total calculation, which lives in the report layer, not here.

-- ------------------------------------------------------------------ payment_type_summary  (old: Payment Type Summary)
WITH nslm AS (
    SELECT DISTINCT location_name, brand_name, host_location_id, store_id
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL
)
SELECT count(a.order_id)                                                 AS order_count,
       a.end_day::date                                                   AS end_day,
       sum(a.payment_amount)                                             AS tender_amount,
       replace(a.payment_type_name, 'Cash Drop', 'Cash')                 AS payment_type,
       e.location_name,
       replace(replace(e.brand_name, 'Wendy''s', 'WENDYS'), 'WENDY''S', 'WENDYS') AS brand_name,
       e.host_location_id::text                                          AS host_location_id,
       replace(concat(e.host_location_id, '-', e.brand_name), 'Wendy''s', 'WENDYS') AS lb_name
FROM master.pos_order_payments a
JOIN nslm e ON a.store_id = e.store_id
WHERE a.end_day >= date_trunc('year', current_date) - interval '2 years'
  AND a.end_day <= current_date::timestamp
GROUP BY a.end_day::date, a.payment_type_name, e.location_name, e.brand_name, e.host_location_id;

-- ------------------------------------------------------------------ cash_paidout  (old: Cash_Paidout)
SELECT b.location_name,
       b.brand_name,
       sum(a.payment_amount)                                             AS payment_amount,
       replace(concat(b.host_location_id, '-', b.brand_name), 'Wendy''s', 'WENDYS') AS lb_name,   -- D1
       a.end_day::date                                                   AS end_day,
       'Cash'::text                                                      AS payment_type_name
FROM master.pos_order_paid_outs a
JOIN (SELECT DISTINCT location_name, brand_name, host_location_id, guid, store_id
      FROM master.netsuite_location_mapping
      WHERE host_location_id IS NOT NULL) b
  ON a.store_id = b.store_id
GROUP BY a.menu_item_name, b.location_name, a.end_day::date, b.brand_name, b.host_location_id;

-- ------------------------------------------------------------------ location_brand  (old: LOCATION&BRAND)
-- Order matters and is kept: de-duplicate on the key first, then drop rows without a ct_location.
WITH src AS (
    SELECT DISTINCT location_name, brand_name, host_location_id, guid, ct_location,
           concat(host_location_id, '-', brand_name) AS lb_name
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL
), dedup AS (
    SELECT DISTINCT ON (lb_name) *
    FROM src
    ORDER BY lb_name          -- old report kept an arbitrary first row per key; see note in 05_sources.md
)
SELECT d.location_name                                   AS plaza,
       d.brand_name                                      AS brand,
       d.host_location_id,
       d.guid,
       replace(d.lb_name, 'Wendy''s', 'WENDYS')          AS location_brand_key,
       d.ct_location,
       dd.district_director
FROM dedup d
LEFT JOIN master.district_directors dd ON dd.host_location_id = d.host_location_id
WHERE d.ct_location IS NOT NULL;

-- ------------------------------------------------------------------ payment_type_detail  (old: PaymentType Detail)
SELECT DISTINCT
       t.payment_type_name,
       CASE t.payment_type_name
            WHEN 'Cash'                THEN 1
            WHEN 'US Cash'             THEN 2
            WHEN 'Debit Card'          THEN 3
            WHEN 'Visa'                THEN 4
            WHEN 'Mastercard'          THEN 5
            WHEN 'AMEX'                THEN 6
            WHEN 'Discover'            THEN 7
            WHEN 'Tim Card'            THEN 8
            WHEN 'Starbucks Card'      THEN 9
            WHEN 'Gift Card'           THEN 10
            WHEN 'Onine Catering Cash' THEN 11   -- typo kept from the old report; lands on 11 either way
            WHEN 'On Account'          THEN 12
            WHEN 'Paid Out'            THEN 13
            ELSE 11
       END AS sequence
FROM (SELECT DISTINCT trim(replace(trim(payment_type_name), 'Cash Drop', 'Cash')) AS payment_type_name
      FROM master.pos_order_payments) t;

-- ------------------------------------------------------------------ district  (old: District; load-time only)
SELECT plaza, district, district_director, host_location_id
FROM master.district_directors;

-- ------------------------------------------------------------------ date  (old: DAX CALENDAR("2019-01-01", TODAY()))
SELECT d::date AS date,
       (d::date - current_date) AS ex_today
FROM generate_series(date '2019-01-01', current_date, interval '1 day') AS d;
