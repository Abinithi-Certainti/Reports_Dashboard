-- 002_tender_report_column_map.sql
-- Old -> new columns for the columns the Tender Report actually uses (from its source SQL, extracts/tender-report/05_sources.md).
-- New side checked against catalog.new_db_column (the new DB structure export of 24 Sep 2026).
-- match_method: snake_case = same name converted to snake_case; manual = the rule does not produce it, a person must confirm.

BEGIN;

-- The four table names now exist in the new DB structure export, so they are confirmed at table level.
UPDATE catalog.table_map tm
SET confirmed = true,
    evidence  = evidence || '; present in new DB structure export 24 Sep 2026'
WHERE EXISTS (SELECT 1 FROM catalog.new_db_column n
              WHERE n.schema_name = tm.new_schema AND n.table_name = tm.new_table);

INSERT INTO catalog.column_map (table_map_id, old_column, new_column, new_data_type, match_method)
SELECT tm.table_map_id, m.old_column, m.new_column, n.data_type, m.match_method
FROM (VALUES
 ('POS_ORDERPAYMENTS',        'OrderID',           'order_id',          'snake_case'),
 ('POS_ORDERPAYMENTS',        'EndDay',            'end_day',           'snake_case'),
 ('POS_ORDERPAYMENTS',        'PaymentAmount',     'payment_amount',    'snake_case'),
 ('POS_ORDERPAYMENTS',        'PaymentTypeName',   'payment_type_name', 'snake_case'),
 ('POS_ORDERPAYMENTS',        'StoreId',           'store_id',          'snake_case'),
 ('POS_ORDERPAIDOUTS',        'PaymentAmount',     'payment_amount',    'snake_case'),
 ('POS_ORDERPAIDOUTS',        'EndDay',            'end_day',           'snake_case'),
 ('POS_ORDERPAIDOUTS',        'StoreId',           'store_id',          'snake_case'),
 ('POS_ORDERPAIDOUTS',        'MenuItemName',      'menu_item_name',    'snake_case'),
 ('NetSuiteLocation_Mapping', 'LocationName',      'location_name',     'snake_case'),
 ('NetSuiteLocation_Mapping', 'BrandName',         'brand_name',        'snake_case'),
 ('NetSuiteLocation_Mapping', 'HostLocationID',    'host_location_id',  'snake_case'),
 ('NetSuiteLocation_Mapping', 'StoreID',           'store_id',          'snake_case'),
 ('NetSuiteLocation_Mapping', 'GUID',              'guid',              'snake_case'),
 ('NetSuiteLocation_Mapping', 'CTLOCATION',        'ct_location',       'manual'),
 ('District_Directors',       'Plaza',             'plaza',             'snake_case'),
 ('District_Directors',       'District',          'district',          'snake_case'),
 ('District_Directors',       'District_Director', 'district_director', 'snake_case'),
 ('District_Directors',       'HostLocationID',    'host_location_id',  'snake_case')
) AS m(old_table, old_column, new_column, match_method)
JOIN catalog.table_map tm ON tm.old_schema = 'dbo' AND tm.old_table = m.old_table
LEFT JOIN catalog.new_db_column n
       ON n.schema_name = tm.new_schema AND n.table_name = tm.new_table AND n.column_name = m.new_column;

-- Guard: every mapped new column must exist in the new DB structure.
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM catalog.column_map WHERE new_data_type IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION '% mapped column(s) not found in the new DB structure', missing;
  END IF;
END $$;

COMMIT;
