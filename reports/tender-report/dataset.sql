-- Tender Report dataset for the report engine: one flat row per store / brand / day / payment type.
-- Built from the translated queries in queries.sql. Tenders and paid-outs are stacked (UNION ALL) so one
-- measure, tender_amount - paidout_amount, gives the old "Tender amount 2".
-- Single statement, no semicolons: the engine wraps it as WITH d AS (...).
WITH nslm AS (
    SELECT DISTINCT location_name, brand_name, host_location_id, store_id
    FROM master.netsuite_location_mapping
    WHERE host_location_id IS NOT NULL
), tenders AS (
    SELECT a.end_day::date                                                         AS end_day,
           replace(a.payment_type_name, 'Cash Drop', 'Cash')                       AS payment_type,
           replace(concat(e.host_location_id, '-', e.brand_name), 'Wendy''s', 'WENDYS') AS lb_name,
           a.payment_amount                                                        AS amount
    FROM master.pos_order_payments a
    JOIN nslm e ON a.store_id = e.store_id
    WHERE a.end_day >= date_trunc('year', current_date) - interval '2 years'
      AND a.end_day <= current_date::timestamp
), paidouts AS (
    SELECT a.end_day::date                                                         AS end_day,
           replace(concat(b.host_location_id, '-', b.brand_name), 'Wendy''s', 'WENDYS') AS lb_name,
           a.payment_amount                                                        AS amount
    FROM master.pos_order_paid_outs a
    JOIN (SELECT DISTINCT location_name, brand_name, host_location_id, store_id
          FROM master.netsuite_location_mapping
          WHERE host_location_id IS NOT NULL) b ON a.store_id = b.store_id
), location_brand AS (
    SELECT l.location_name AS plaza,
           l.brand_name    AS brand,
           replace(l.lb_name, 'Wendy''s', 'WENDYS') AS location_brand_key,
           dd.district_director
    FROM (SELECT DISTINCT ON (lb_name) *
          FROM (SELECT DISTINCT location_name, brand_name, host_location_id, ct_location,
                       concat(host_location_id, '-', brand_name) AS lb_name
                FROM master.netsuite_location_mapping
                WHERE host_location_id IS NOT NULL) s
          ORDER BY lb_name) l
    LEFT JOIN master.district_directors dd ON dd.host_location_id = l.host_location_id
    WHERE l.ct_location IS NOT NULL
), payment_type_detail AS (
    SELECT DISTINCT t.payment_type_name,
           CASE t.payment_type_name
                WHEN 'Cash' THEN 1 WHEN 'US Cash' THEN 2 WHEN 'Debit Card' THEN 3 WHEN 'Visa' THEN 4
                WHEN 'Mastercard' THEN 5 WHEN 'AMEX' THEN 6 WHEN 'Discover' THEN 7 WHEN 'Tim Card' THEN 8
                WHEN 'Starbucks Card' THEN 9 WHEN 'Gift Card' THEN 10 WHEN 'On Account' THEN 12
                WHEN 'Paid Out' THEN 13 ELSE 11
           END AS sequence
    FROM (SELECT DISTINCT trim(replace(trim(payment_type_name), 'Cash Drop', 'Cash')) AS payment_type_name
          FROM master.pos_order_payments) t
), stacked AS (
    SELECT end_day, lb_name, payment_type, amount AS tender_amount, 0::numeric AS paidout_amount FROM tenders
    UNION ALL
    SELECT end_day, lb_name, 'Cash', 0::numeric, amount FROM paidouts
)
-- LEFT JOINs keep rows whose store key has no match, as Power BI does (they show as blank Plaza/Brand).
SELECT s.end_day,
       lb.plaza,
       lb.brand,
       lb.district_director,
       s.payment_type,
       coalesce(ptd.sequence, 11) AS sequence,
       s.tender_amount,
       s.paidout_amount
FROM stacked s
LEFT JOIN location_brand lb       ON lb.location_brand_key = s.lb_name
LEFT JOIN payment_type_detail ptd ON ptd.payment_type_name = s.payment_type
