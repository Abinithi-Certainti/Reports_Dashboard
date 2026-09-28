-- Tender Report dataset for the report engine: one flat row per store / brand / day / payment type.
-- QA-ONLY version (2026-09-28): every table here exists in QA schema master. The old version joined
-- netsuite_location_mapping and district_directors, which are missing in QA.
--   Store -> plaza and brand now comes from QA location_code_mappings.description,
--   which reads "ONRoute : <location code> : <plaza number> <BRAND>", e.g. "ONRoute : TIM23 : 23 TIM HORTONS".
--   Plaza   = "Plaza <plaza number>" (QA has no plaza name yet - a DEV lookup is planned).
--   Brand   = the brand text after the plaza number, upper case, "WENDY'S" -> "WENDYS" as in the old report.
--   District Director = empty: district_directors is missing in QA.
-- Tenders and paid-outs are stacked (UNION ALL) so one measure, tender_amount - paidout_amount, gives the old
-- "Tender amount 2". Single statement, no semicolons: the engine wraps it as WITH d AS (...).
WITH store AS (
    -- location_code_mappings can hold more than one row per store: keep the most recently updated one.
    SELECT DISTINCT ON (m.store_id)
           m.store_id,
           m.location_code,
           trim(split_part(m.description, ' : ', 3)) AS plaza_brand
    FROM master.location_code_mappings m
    WHERE m.store_id IS NOT NULL
    ORDER BY m.store_id, m.updated_at DESC NULLS LAST, m.created_at DESC NULLS LAST
), loc AS (
    SELECT store_id,
           location_code,
           CASE WHEN substring(plaza_brand FROM '^[0-9]+') IS NOT NULL
                THEN 'Plaza ' || substring(plaza_brand FROM '^[0-9]+') END                AS plaza,
           nullif(replace(upper(trim(regexp_replace(plaza_brand, '^[0-9]+', ''))), 'WENDY''S', 'WENDYS'), '') AS brand
    FROM store
), tenders AS (
    SELECT a.end_day::date                                   AS end_day,
           a.store_id,
           replace(a.payment_type_name, 'Cash Drop', 'Cash') AS payment_type,
           a.payment_amount                                  AS amount
    FROM master.pos_order_payments a
    WHERE a.end_day >= date_trunc('year', current_date) - interval '2 years'
      AND a.end_day <= current_date::timestamp
), paidouts AS (
    -- pos_order_paid_outs is empty on QA today, so paid-outs show as 0 until it is loaded.
    SELECT a.end_day::date AS end_day,
           a.store_id,
           a.payment_amount AS amount
    FROM master.pos_order_paid_outs a
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
    SELECT end_day, store_id, payment_type, amount AS tender_amount, 0::numeric AS paidout_amount FROM tenders
    UNION ALL
    SELECT end_day, store_id, 'Cash', 0::numeric, amount FROM paidouts
)
-- Only stores found in location_code_mappings are shown (the old report showed only mapped stores too).
SELECT s.end_day,
       l.plaza,
       l.brand,
       NULL::text                 AS district_director,
       s.payment_type,
       coalesce(ptd.sequence, 11) AS sequence,
       s.tender_amount,
       s.paidout_amount
FROM stacked s
JOIN loc l                        ON l.store_id = s.store_id
LEFT JOIN payment_type_detail ptd ON ptd.payment_type_name = s.payment_type
