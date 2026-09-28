-- Financial Reports (AG-82). Source of truth for the old report: extracts/financial-reports/01_model.md
-- Uses QA tables only: pos_orders, pos_order_details, pos_order_paid_outs, location_code_mappings.
-- One row per day, store and item group. Each amount column is 0 on the other groups' rows, so every measure is a sum.
--   hst            = POS order tax
--   gift_card      = gift card sales (department Gift Card, Retail - gift card, Tim Card, gift cards - any case, as in DAX)
--   donations      = department Donations, or the menu item Camp Day Bracelet, by donation item (kitchen name)
--   lottery_amount = lottery sales (Instant Tickets, Open Lottery) minus redemptions (Lottery Redemption / Lottery
--                    Payout items, and every cash paid out, as in the old report)
-- Plaza: QA has no plaza names, only the plaza number inside location_code_mappings.description
-- ("ONRoute : TIM23 : 23 TIM HORTONS"). Plaza shows as "Plaza 23" until a plaza-name lookup is added.
-- District Director is not in QA, so it is not offered as a filter here.
-- location_code_mappings holds 120 rows for 115 stores, so one row per store is kept (the lowest location_code).
-- No semicolons anywhere in this file, comments included.
WITH store AS (
    SELECT DISTINCT ON (m.store_id)
           m.store_id,
           m.location_code,
           'Plaza ' || split_part(split_part(m.description, ' : ', 3), ' ', 1) AS plaza,
           upper(trim(substr(split_part(m.description, ' : ', 3), strpos(split_part(m.description, ' : ', 3), ' ') + 1))) AS brand
    FROM master.location_code_mappings m
    ORDER BY m.store_id, m.location_code
), items AS (
    SELECT o.end_day::date AS day, o.store_id, CAST(NULL AS text) AS donation_item,
           CAST(NULL AS text) AS lottery_category, CAST(NULL AS text) AS lottery_type,
           sum(o.tax) AS hst, 0::numeric AS gift_card, 0::numeric AS donations, 0::numeric AS lottery_amount
    FROM master.pos_orders o
    GROUP BY 1, 2
    UNION ALL
    SELECT d.end_day::date, d.store_id, NULL, NULL, NULL, 0, sum(d.value_added_base_price), 0, 0
    FROM master.pos_order_details d
    WHERE lower(d.department_name) IN ('gift card', 'retail - gift card', 'tim card', 'gift cards')
      AND d.menu_item_name <> 'Card Fee'
    GROUP BY 1, 2
    UNION ALL
    SELECT d.end_day::date, d.store_id, d.kitchen_name, NULL, NULL, 0, 0, sum(d.value_added_base_price), 0
    FROM master.pos_order_details d
    WHERE d.department_name = 'Donations' OR d.menu_item_name = 'Camp Day Bracelet'
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT d.end_day::date, d.store_id, NULL,
           CASE WHEN d.menu_item_name IN ('Lottery Redemption', 'Lottery Payout') THEN 'Redemptions' ELSE 'Sales' END,
           CASE WHEN d.department_name = 'Open Lottery' THEN 'Open lottery' ELSE d.department_name END,
           0, 0, 0, sum(d.value_added_base_price)
    FROM master.pos_order_details d
    WHERE d.department_name IN ('Instant Tickets', 'Open Lottery')
    GROUP BY 1, 2, 4, 5
    UNION ALL
    SELECT p.end_day::date, p.store_id, NULL, 'Redemptions', 'Redemptions', 0, 0, 0, -sum(p.payment_amount)
    FROM master.pos_order_paid_outs p
    GROUP BY 1, 2
)
SELECT i.day,
       coalesce(s.plaza, 'Store ' || i.store_id) AS plaza,
       coalesce(s.brand, '(not mapped)')        AS brand,
       i.store_id,
       i.donation_item,
       i.lottery_category,
       i.lottery_type,
       i.hst,
       i.gift_card,
       i.donations,
       i.lottery_amount
FROM items i
LEFT JOIN store s ON s.store_id = i.store_id
