-- 001_tender_report.sql
-- Tender Report, extracted 24 Sep 2026 with read-only DAX INFO queries (see docs/extraction-guide.md)
-- and a PDF export of the page. Source files: extracts/tender-report/.

BEGIN;

INSERT INTO catalog.report (report_name, workspace, owner, source_server, source_database, source_schema,
                            extracted_on, extraction_method, status, notes)
VALUES ('Tender Report', 'Finance', 'Finance (report), Power BI Reports (semantic model)',
        'etlsqlservercaeprd01.database.windows.net', 'ETLServerSQL', 'dbo',
        '2026-09-24', 'DAX INFO queries in Viewing mode + PDF export', 'extracted',
        'Download disabled in the Power BI Service. Rebuild on PostgreSQL tracked on AG-66.');

-- ---------------------------------------------------------------- model tables
INSERT INTO catalog.model_table (report_id, table_name, table_kind, is_hidden, source_query, transform_steps, dax_expression)
SELECT r.report_id, t.table_name, t.table_kind, t.is_hidden, t.source_query, t.transform_steps, t.dax_expression
FROM catalog.report r,
(VALUES
 ('Payment Type Summary', 'source', false,
  $q$WITH nslm AS (
  SELECT DISTINCT [LocationName], [BrandName], [HostLocationID], storeid
  FROM [dbo].[NetSuiteLocation_Mapping]
  WHERE HostLocationID IS NOT NULL)
SELECT COUNT(a.[OrderID]) AS OrderID, a.[endday], SUM(a.[PaymentAmount]) AS PaymentAmount,
       a.[PaymentTypeName], e.LocationName, e.BrandName, e.hostlocationid
FROM [dbo].[POS_ORDERPAYMENTS] a
JOIN nslm e ON a.StoreId = e.StoreID
WHERE Endday BETWEEN CAST(DATEADD(yy,DATEDIFF(yy,0,GETDATE())-2,0) AS smalldatetime)
                 AND CAST(CAST(GETDATE() AS date) AS smalldatetime)
GROUP BY a.[endday], a.[PaymentTypeName], e.LocationName, e.BrandName, e.hostlocationid$q$,
  $s$1. endday -> date only
2. rename PaymentAmount -> Tender Amount
3. hostlocationid -> text
4. add LB_name = hostlocationid & "-" & BrandName
5. BrandName "Wendy's" -> "WENDYS"; LB_name "Wendy's" -> "WENDYS"; BrandName "WENDY'S" -> "WENDYS"
6. rename PaymentTypeName -> Payment Type
7. Payment Type "Cash Drop" -> "Cash" (substring replace)$s$, NULL),
 ('Cash_Paidout', 'source', true,
  $q$select b.LocationName, b.BrandName, sum(a.paymentamount) as PaymentAmount,
       CONCAT(hostlocationid, '-', BrandName) as LB_name, cast(a.EndDay as date) as endday
from POS_ORDERPAIDOUTS a
join (SELECT distinct [LocationName], [BrandName], [HostLocationID], [GUID], StoreID,
             concat(hostlocationID, '-', Brandname) as LB_name
      FROM [dbo].[NetSuiteLocation_Mapping] where HostLocationID is not null) b
  on a.StoreId = b.StoreID
group by MenuItemName, b.LocationName, cast(a.endday as date), b.BrandName, CONCAT(hostlocationid, '-', BrandName)$q$,
  $s$1. add PaymentTypeName = "Cash" for every row
2. set types: PaymentTypeName text, endday date$s$, NULL),
 ('LOCATION&BRAND', 'source', false,
  $q$SELECT distinct [LocationName], [BrandName], [HostLocationID], [GUID], CTLOCATION,
       concat(hostlocationID, '-', Brandname) as LB_name
FROM [dbo].[NetSuiteLocation_Mapping] where HostLocationID is not null$q$,
  $s$1. remove duplicates on LB_name
2. rename LB_name -> LOCATIONID&BRAND
3. LOCATIONID&BRAND "Wendy's" -> "WENDYS"
4. keep rows where CTLOCATION is not null
5. left join District on HostLocationID, bring District_Director in as "District Director"
6. rename LocationName -> Plaza, BrandName -> Brand$s$, NULL),
 ('PaymentType Detail', 'source', false,
  $q$select distinct trim(PaymentTypeName) as PaymentTypeName from POS_ORDERPAYMENTS$q$,
  $s$1. "Cash Drop" -> "Cash"
2. add sequence: Cash 1, US Cash 2, Debit Card 3, Visa 4, Mastercard 5, AMEX 6, Discover 7, Tim Card 8,
   Starbucks Card 9, Gift Card 10, "Onine Catering Cash" 11 (typo), On Account 12, Paid Out 13, anything else 11
3. trim, remove duplicates$s$, NULL),
 ('District', 'source', true,
  $q$select * from District_Directors$q$,
  $s$1. sort by HostLocationID descending
Used only as a load-time merge into LOCATION&BRAND. No model relationship.$s$, NULL),
 ('Date', 'dax', false, NULL, NULL, $d$CALENDAR("2019-01-01", TODAY())$d$),
 ('Report', 'placeholder', false, NULL, NULL, $d$Row("Column", BLANK())$d$)
) AS t(table_name, table_kind, is_hidden, source_query, transform_steps, dax_expression)
WHERE r.report_name = 'Tender Report';

-- ---------------------------------------------------------------- columns
INSERT INTO catalog.model_column (model_table_id, column_name, data_type, column_kind, is_hidden, sort_by_column, dax_expression)
SELECT mt.model_table_id, c.column_name, c.data_type, c.column_kind, c.is_hidden, c.sort_by_column, c.dax_expression
FROM catalog.model_table mt
JOIN catalog.report r ON r.report_id = mt.report_id AND r.report_name = 'Tender Report'
JOIN (VALUES
 ('Payment Type Summary', 'LocationName',   'text',    'data', true,  NULL, NULL),
 ('Payment Type Summary', 'BrandName',      'text',    'data', true,  NULL, NULL),
 ('Payment Type Summary', 'OrderID',        'integer', 'data', true,  NULL, NULL),
 ('Payment Type Summary', 'Tender Amount',  'double',  'data', true,  NULL, NULL),
 ('Payment Type Summary', 'hostlocationid', 'text',    'data', true,  NULL, NULL),
 ('Payment Type Summary', 'LB_name',        'text',    'data', true,  NULL, NULL),
 ('Payment Type Summary', 'Payment Type',   'text',    'data', false, 'sequence 2', NULL),
 ('Payment Type Summary', 'endday',         'date',    'data', true,  NULL, NULL),
 ('Payment Type Summary', 'sequence 2',     'integer', 'calculated', true, NULL, $d$RELATED('PaymentType Detail'[sequence])$d$),
 ('Payment Type Summary', 'cashdrop',       'double',  'calculated', true, NULL,
    $d$CALCULATE(SUM('Payment Type Summary'[Tender Amount]), 'Payment Type Summary'[Payment Type] = "Cash Drop")$d$),
 ('LOCATION&BRAND', 'Plaza',             'text',    'data', false, NULL, NULL),
 ('LOCATION&BRAND', 'Brand',             'text',    'data', false, NULL, NULL),
 ('LOCATION&BRAND', 'hostlocationid',    'integer', 'data', true,  NULL, NULL),
 ('LOCATION&BRAND', 'GUID',              'text',    'data', true,  NULL, NULL),
 ('LOCATION&BRAND', 'LOCATIONID&BRAND',  'text',    'data', false, NULL, NULL),
 ('LOCATION&BRAND', 'CTLOCATION',        'text',    'data', true,  NULL, NULL),
 ('LOCATION&BRAND', 'District Director', 'text',    'data', false, NULL, NULL),
 ('Cash_Paidout', 'LocationName',    'text',   'data', true, NULL, NULL),
 ('Cash_Paidout', 'BrandName',       'text',   'data', true, NULL, NULL),
 ('Cash_Paidout', 'PaymentAmount',   'double', 'data', true, NULL, NULL),
 ('Cash_Paidout', 'LB_name',         'text',   'data', true, NULL, NULL),
 ('Cash_Paidout', 'endday',          'date',   'data', true, NULL, NULL),
 ('Cash_Paidout', 'PaymentTypeName', 'text',   'data', true, NULL, NULL),
 ('PaymentType Detail', 'PaymentTypeName', 'text',    'data', false, 'sequence', NULL),
 ('PaymentType Detail', 'sequence',        'integer', 'data', true,  NULL, NULL),
 ('District', 'Plaza',             'text',    'data', true,  NULL, NULL),
 ('District', 'District',          'text',    'data', true,  NULL, NULL),
 ('District', 'District_Director', 'text',    'data', false, NULL, NULL),
 ('District', 'hostlocationid',    'integer', 'data', false, NULL, NULL),
 ('Date', 'Date',     'date',    'calc_table', false, NULL, NULL),
 ('Date', 'ex today', 'integer', 'calculated', false, NULL, $d$'Date'[Date]-MAX('Date'[Date])$d$)
) AS c(table_name, column_name, data_type, column_kind, is_hidden, sort_by_column, dax_expression)
  ON c.table_name = mt.table_name;

-- ---------------------------------------------------------------- measures
INSERT INTO catalog.measure (report_id, measure_name, home_table, dax_expression, format_string, is_hidden, plain_english)
SELECT r.report_id, m.* FROM catalog.report r,
(VALUES
 ('Cash-paidout', 'Payment Type Summary',
  $d$var cash_payment = CALCULATE(SUM('Payment Type Summary'[Tender Amount]),FILTER('Payment Type Summary', 'Payment Type Summary'[Payment Type] = "Cash"))
var paidout_cash = CALCULATE(SUM(Cash_Paidout[PaymentAmount]))
return cash_payment-paidout_cash$d$, NULL, true, 'Cash tenders minus paid-outs.'),
 ('All_Payment_Type ex cash', 'Payment Type Summary',
  $d$var cashfilter = CALCULATETABLE('Payment Type Summary', 'Payment Type Summary'[Payment Type] <> "Cash", ALL('Payment Type Summary'[sequence 2]))
return CALCULATE(SUM('Payment Type Summary'[Tender Amount]),cashfilter)$d$, NULL, true, 'Tender amount for every payment type except Cash.'),
 ('Total Payment', 'Payment Type Summary', $d$[All_Payment_Type ex cash]+[Cash-paidout]$d$,
  '$#,0.00;($#,0.00);$#,0.00', true, 'All tenders minus paid-outs. Loses the cash part on non-cash rows (see findings).'),
 ('Cash-CashDrop', 'Payment Type Summary',
  $d$CALCULATE(sum('Payment Type Summary'[Tender Amount]),'PaymentType Detail'[PaymentTypeName]="Cash")+CALCULATE(SUM('Payment Type Summary'[Tender Amount]),'PaymentType Detail'[PaymentTypeName]="Cash Drop")$d$,
  NULL, true, 'Adds Cash and Cash Drop despite the minus in its name. Cash Drop never exists after load, so this equals Cash.'),
 ('Tender amount 2', 'Report', $d$sum('Payment Type Summary'[Tender Amount])-sum(Cash_Paidout[PaymentAmount])$d$,
  '$#,0.00;($#,0.00);$#,0.00', false, 'Tender amount minus paid-outs in the current row. Paid-outs are all Cash, so only the Cash row is reduced.'),
 ('% to Total', 'Report', $d$DIVIDE([Tender amount 2], [Total Payment])$d$,
  '0.00%;-0.00%;0.00%', false, 'Row share of Total Payment. Does not add to 100% (see findings).'),
 ('Debug Total Payment', 'Report', $d$[Total Payment]$d$, NULL, false, 'Copy of Total Payment. Looks like a leftover; confirm no visual uses it.')
) AS m(measure_name, home_table, dax_expression, format_string, is_hidden, plain_english)
WHERE r.report_name = 'Tender Report';

-- ---------------------------------------------------------------- relationships
INSERT INTO catalog.relationship (report_id, from_table, from_column, to_table, to_column, cross_filter)
SELECT r.report_id, x.* FROM catalog.report r,
(VALUES
 ('Payment Type Summary', 'LB_name',         'LOCATION&BRAND',     'LOCATIONID&BRAND', 'one_direction'),
 ('Payment Type Summary', 'endday',          'Date',               'Date',             'one_direction'),
 ('Payment Type Summary', 'Payment Type',    'PaymentType Detail', 'PaymentTypeName',  'both_directions'),
 ('Cash_Paidout',         'LB_name',         'LOCATION&BRAND',     'LOCATIONID&BRAND', 'one_direction'),
 ('Cash_Paidout',         'endday',          'Date',               'Date',             'one_direction'),
 ('Cash_Paidout',         'PaymentTypeName', 'PaymentType Detail', 'PaymentTypeName',  'one_direction')
) AS x(from_table, from_column, to_table, to_column, cross_filter)
WHERE r.report_name = 'Tender Report';

-- ---------------------------------------------------------------- visuals (page 1)
INSERT INTO catalog.visual (report_id, page_name, visual_order, visual_type, title, fields)
SELECT r.report_id, 'Tender Report', v.* FROM catalog.report r,
(VALUES
 (1, 'slicer_dropdown',   'Plaza',             '{"field": "LOCATION&BRAND[Plaza]"}'::jsonb),
 (2, 'slicer_dropdown',   'District Director', '{"field": "LOCATION&BRAND[District Director]"}'::jsonb),
 (3, 'slicer_date_range', 'Date',              '{"field": "Date[Date]"}'::jsonb),
 (4, 'slicer_dropdown',   'Brand',             '{"field": "LOCATION&BRAND[Brand]"}'::jsonb),
 (5, 'slicer_dropdown',   'Payment Type',      '{"field": "Payment Type (table to confirm)"}'::jsonb),
 (6, 'table',  'Selected Locations - Summary',
    '{"rows": ["Payment Type"], "values": ["Tender amount 2 (label: Tender amount)", "% to Total"], "total_row": true}'::jsonb),
 (7, 'matrix', 'All Locations - Detail',
    '{"rows": ["LOCATION&BRAND[Plaza]", "LOCATION&BRAND[Brand]", "Payment Type"], "columns": ["Date[Date] (one column per day)"], "values": ["Tender amount 2"], "subtotals": true}'::jsonb)
) AS v(visual_order, visual_type, title, fields)
WHERE r.report_name = 'Tender Report';

-- ---------------------------------------------------------------- business rules
INSERT INTO catalog.business_rule (report_id, rule_text, found_in, decision)
SELECT r.report_id, b.* FROM catalog.report r,
(VALUES
 ('"Cash Drop" is merged into "Cash".', 'Payment Type Summary step 7; PaymentType Detail step 1', 'keep'),
 ('All paid-outs are Cash and are subtracted from the Cash row only.', 'Cash_Paidout step 1; Tender amount 2', 'keep'),
 ('Brand "Wendy''s" / "WENDY''S" is shown as "WENDYS".', 'Payment Type Summary step 5; LOCATION&BRAND step 3', 'keep'),
 ('Payment types are shown in a fixed order: Cash, US Cash, Debit Card, Visa, Mastercard, AMEX, Discover, Tim Card, Starbucks Card, Gift Card, then others, On Account, Paid Out.', 'PaymentType Detail step 2', 'keep'),
 ('Only stores with a HostLocationID and a CTLOCATION are shown.', 'LOCATION&BRAND SQL and step 4', 'keep'),
 ('Tenders cover 1 Jan of (current year - 2) to today; paid-outs cover all history.', 'Payment Type Summary SQL; Cash_Paidout SQL', 'pending')
) AS b(rule_text, found_in, decision)
WHERE r.report_name = 'Tender Report';

-- ---------------------------------------------------------------- findings
INSERT INTO catalog.finding (report_id, severity, finding_text, verified, status, decision_owner)
SELECT r.report_id, f.* FROM catalog.report r,
(VALUES
 ('high', '% to Total does not add to 100% (visible rows sum to 108.66%). Cash row divides by the grand total; other rows divide by total minus cash. Cause: [Total Payment] loses the cash part on non-cash rows.', true, 'open', 'Business owner'),
 ('medium', 'Cash_Paidout builds LB_name without the Wendy''s -> WENDYS fix, so paid-outs for a brand spelled "Wendy''s" may not link to their store.', false, 'open', NULL),
 ('low', 'Payment type casing is inconsistent: "DO AMEX" vs "DO Amex".', true, 'open', NULL),
 ('low', 'cashdrop column and Cash-CashDrop measure are dead code: Cash Drop no longer exists after load.', true, 'open', NULL),
 ('low', 'Debug Total Payment is a visible copy of Total Payment.', true, 'open', NULL),
 ('low', 'Money columns are stored as double (floating point) rather than a fixed decimal type.', true, 'open', NULL)
) AS f(severity, finding_text, verified, status, decision_owner)
WHERE r.report_name = 'Tender Report';

-- ---------------------------------------------------------------- old -> new tables
-- New names come from the mapping recorded on AG-66. Not yet checked against the new database, so confirmed = false.
INSERT INTO catalog.table_map (old_schema, old_table, new_schema, new_table, evidence, confirmed) VALUES
 ('dbo', 'POS_ORDERPAYMENTS',        'master', 'pos_order_payments',        'AG-66 mapping', false),
 ('dbo', 'POS_ORDERPAIDOUTS',        'master', 'pos_order_paid_outs',       'AG-66 mapping', false),
 ('dbo', 'NetSuiteLocation_Mapping', 'master', 'netsuite_location_mapping', 'AG-66 mapping', false),
 ('dbo', 'District_Directors',       'master', 'district_directors',        'AG-66 mapping', false)
ON CONFLICT (old_schema, old_table) DO NOTHING;

COMMIT;
