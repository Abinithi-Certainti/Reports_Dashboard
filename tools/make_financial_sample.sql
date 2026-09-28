-- MADE-UP source rows for the Financial Reports demo (AG-82). Loaded into a throwaway local copy of the QA structure,
-- then reports/financial-reports/dataset.sql is run over them to produce demo/static-data/financial-rows.json.
-- Nothing here is real: stores, plazas and amounts are invented.
INSERT INTO master.location_code_mappings (description, location_code, store_id) VALUES
 ('ONRoute : TIM90 : 90 TIM HORTONS', 'TIM90', '900001'),
 ('ONRoute : MKT90 : 90 MARKET',      'MKT90', '900002'),
 ('ONRoute : SBX91 : 91 STARBUCKS',   'SBX91', '900003'),
 ('ONRoute : TIM91 : 91 TIM HORTONS', 'TIM91', '900004'),
 ('ONRoute : TIM91 : 91 TIM HORTONS', 'TIM91', '900004');  -- duplicate on purpose: must not double-count
INSERT INTO master.pos_orders (order_id, end_day, tax, net, store_id, order_type_name)
SELECT row_number() OVER (), d + time '06:00', round((80 + 40 * random())::numeric * (s.f), 2), 0, s.id, 'Take Out'
FROM generate_series(date '2026-09-06', date '2026-09-21', interval '1 day') d,
     (VALUES ('900001', 1.0), ('900002', 1.4), ('900003', 0.6), ('900004', 0.9)) s(id, f),
     generate_series(1, 12) n;
INSERT INTO master.pos_order_details (order_id, end_day, department_name, menu_item_name, kitchen_name, value_added_base_price, store_id)
SELECT 1, d + time '09:00', x.dept, x.item, x.kitchen, round((x.amt * (0.6 + random()))::numeric, 2), x.store
FROM generate_series(date '2026-09-06', date '2026-09-21', interval '1 day') d,
     (VALUES ('Gift Card', 'Gift Card $25', NULL, 25, '900001'),
             ('Tim Card', 'Tim Card Load', NULL, 40, '900004'),
             ('Retail - Gift Card', 'Starbucks Card', NULL, 30, '900003'),
             ('Gift Card', 'Card Fee', NULL, 2, '900001'),           -- must be left out
             ('Donations', 'Coin Box', 'DON - COINBOX', 12, '900001'),
             ('Donations', 'Smile Cookie', 'DONATN - SMILE', 6, '900004'),
             ('Retail', 'Camp Day Bracelet', 'BRACELET', 5, '900002'),
             ('Instant Tickets', 'Instant Ticket', NULL, 90, '900002'),
             ('Open Lottery', 'Lotto Max', NULL, 150, '900002'),
             ('Open Lottery', 'Lottery Payout', NULL, -40, '900002'),
             ('Coffee', 'Medium Coffee', NULL, 300, '900001')          -- must be left out
     ) x(dept, item, kitchen, amt, store);
INSERT INTO master.pos_order_paid_outs (order_id, end_day, menu_item_name, payment_amount, store_id)
SELECT 1, d + time '15:00', 'Paid Out : lotto win', round((20 + 30 * random())::numeric, 2), '900002'
FROM generate_series(date '2026-09-06', date '2026-09-21', interval '2 day') d;
