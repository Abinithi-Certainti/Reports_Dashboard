-- SAMPLE DATA for the Tender Report demo. Every store, name and amount here is made up.
-- Loaded into a local copy of the new tables (structure from extracts/new-db/master_columns.tsv).
-- It deliberately includes "Cash Drop" rows and a "Wendy's" brand, so the report's business rules can be seen working.

SELECT setseed(0.42);

INSERT INTO master.netsuite_location_mapping (location_id, location_name, brand_name, host_location_id, store_id, guid, ct_location)
VALUES
 (1, 'Bainsville', 'Burger King', 101, 'S-101-BK', 'g-101-bk', 'CT101'),
 (2, 'Bainsville', 'Tim Hortons', 101, 'S-101-TH', 'g-101-th', 'CT101'),
 (3, 'Market',     'Burger King', 102, 'S-102-BK', 'g-102-bk', 'CT102'),
 (4, 'Market',     'Wendy''s',    102, 'S-102-WE', 'g-102-we', 'CT102'),
 (5, 'Napanee',    'Tim Hortons', 103, 'S-103-TH', 'g-103-th', 'CT103'),
 (6, 'Napanee',    'Starbucks',   103, 'S-103-SB', 'g-103-sb', 'CT103'),
 (7, 'Port Hope',  'Wendy''s',    104, 'S-104-WE', 'g-104-we', 'CT104'),
 (8, 'Port Hope',  'Burger King', 104, 'S-104-BK', 'g-104-bk', 'CT104');

INSERT INTO master.district_directors (plaza, district, district_director, host_location_id) VALUES
 ('Bainsville', 'East', 'Sample Director A', 101),
 ('Market',     'East', 'Sample Director A', 102),
 ('Napanee',    'West', 'Sample Director B', 103),
 ('Port Hope',  'West', 'Sample Director B', 104);

-- One row per store, day and payment type for the last 45 days. Weights give each type a realistic share.
INSERT INTO master.pos_order_payments (id, order_id, end_day, payment_type_name, payment_amount, store_id)
SELECT gen_random_uuid(),
       (random() * 1e9)::bigint,
       day,
       pt.name,
       round((s.base * pt.weight * (0.7 + random() * 0.6))::numeric, 2),
       s.store_id
FROM generate_series(current_date - 44, current_date, interval '1 day') AS day
CROSS JOIN (VALUES ('S-101-BK', 4200), ('S-101-TH', 3100), ('S-102-BK', 3600), ('S-102-WE', 2900),
                   ('S-103-TH', 3300), ('S-103-SB', 1800), ('S-104-WE', 2500), ('S-104-BK', 3000)) AS s(store_id, base)
CROSS JOIN (VALUES ('Cash', 0.11), ('Cash Drop', 0.03), ('US Cash', 0.005), ('Debit Card', 0.30), ('Visa', 0.21),
                   ('Mastercard', 0.12), ('AMEX', 0.03), ('Starbucks Card', 0.02), ('DO Debit', 0.07),
                   ('DO Visa', 0.06), ('DO Mastercard', 0.035)) AS pt(name, weight)
WHERE random() > 0.05;   -- a few gaps, like real data

-- Paid-outs on roughly one day in three per store.
INSERT INTO master.pos_order_paid_outs (id, order_id, end_day, menu_item_name, payment_amount, store_id)
SELECT gen_random_uuid(),
       (random() * 1e9)::bigint,
       day,
       (ARRAY['Supplies', 'Repairs', 'Petty cash'])[1 + floor(random() * 3)::int],
       round((20 + random() * 130)::numeric, 2),
       s.store_id
FROM generate_series(current_date - 44, current_date, interval '1 day') AS day
CROSS JOIN (VALUES ('S-101-BK'), ('S-101-TH'), ('S-102-BK'), ('S-102-WE'),
                   ('S-103-TH'), ('S-103-SB'), ('S-104-WE'), ('S-104-BK')) AS s(store_id)
WHERE random() < 0.33;
