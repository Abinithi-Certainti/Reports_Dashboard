-- Paid-outs by store, brand, reason and day, from the new PostgreSQL model.
SELECT a.end_day::date                 AS end_day,
       n.location_name                 AS plaza,
       n.brand_name                    AS brand,
       coalesce(a.menu_item_name, '(No reason)') AS reason,
       a.payment_amount                AS amount
FROM master.pos_order_paid_outs a
JOIN (SELECT DISTINCT location_name, brand_name, store_id
      FROM master.netsuite_location_mapping
      WHERE host_location_id IS NOT NULL) n ON n.store_id = a.store_id
