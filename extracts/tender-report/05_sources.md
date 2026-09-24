# Tender Report - data sources (from EVALUATE INFO.PARTITIONS(), 24 Sep 2026)
Server: etlsqlservercaeprd01.database.windows.net  Database: ETLServerSQL  Schema: dbo  Mode: Import
Source tables used: POS_ORDERPAYMENTS, POS_ORDERPAIDOUTS, NetSuiteLocation_Mapping, District_Directors

## Payment Type Summary  (tenders)
SQL:
```sql
WITH nslm AS (
  SELECT DISTINCT [LocationName], [BrandName], [HostLocationID], storeid
  FROM [dbo].[NetSuiteLocation_Mapping]
  WHERE HostLocationID IS NOT NULL)
SELECT COUNT(a.[OrderID]) AS OrderID, a.[endday], SUM(a.[PaymentAmount]) AS PaymentAmount,
       a.[PaymentTypeName], e.LocationName, e.BrandName, e.hostlocationid
FROM [dbo].[POS_ORDERPAYMENTS] a
JOIN nslm e ON a.StoreId = e.StoreID
WHERE Endday BETWEEN CAST(DATEADD(yy,DATEDIFF(yy,0,GETDATE())-2,0) AS smalldatetime)
                 AND CAST(CAST(GETDATE() AS date) AS smalldatetime)
GROUP BY a.[endday], a.[PaymentTypeName], e.LocationName, e.BrandName, e.hostlocationid
```
Power Query steps after SQL, in order:
1. endday -> date only
2. rename PaymentAmount -> "Tender Amount"
3. hostlocationid -> text
4. add LB_name = hostlocationid & "-" & BrandName
5. BrandName: "Wendy's" -> "WENDYS";  LB_name: "Wendy's" -> "WENDYS";  BrandName: "WENDY'S" -> "WENDYS"
6. rename PaymentTypeName -> "Payment Type"
7. Payment Type: "Cash Drop" -> "Cash"  (substring replace)
Date window: 1 Jan of (current year - 2) to today.

## Cash_Paidout  (paid-outs)
SQL:
```sql
select b.LocationName, b.BrandName, sum(a.paymentamount) as PaymentAmount,
       CONCAT(hostlocationid, '-', BrandName) as LB_name, cast(a.EndDay as date) as endday
from POS_ORDERPAIDOUTS a
join (SELECT distinct [LocationName], [BrandName], [HostLocationID], [GUID], StoreID,
             concat(hostlocationID, '-', Brandname) as LB_name
      FROM [dbo].[NetSuiteLocation_Mapping] where HostLocationID is not null) b
  on a.StoreId = b.StoreID
group by MenuItemName, b.LocationName, cast(a.endday as date), b.BrandName, CONCAT(hostlocationid, '-', BrandName)
```
Power Query steps: add PaymentTypeName = "Cash" (hard-coded for every row); set types.
No date window (all history).

## LOCATION&BRAND  (store/brand lookup)
SQL:
```sql
SELECT distinct [LocationName], [BrandName], [HostLocationID], [GUID], CTLOCATION,
       concat(hostlocationID, '-', Brandname) as LB_name
FROM [dbo].[NetSuiteLocation_Mapping] where HostLocationID is not null
```
Power Query steps:
1. remove duplicates on LB_name
2. rename LB_name -> "LOCATIONID&BRAND"
3. LOCATIONID&BRAND: "Wendy's" -> "WENDYS"
4. keep rows where CTLOCATION is not null
5. LEFT JOIN District on HostLocationID, bring in District_Director as "District Director"
6. rename LocationName -> Plaza, BrandName -> Brand

## PaymentType Detail  (payment type lookup + display order)
SQL: `select distinct trim(PaymentTypeName) as PaymentTypeName from POS_ORDERPAYMENTS`
Power Query steps: "Cash Drop" -> "Cash"; add sequence; trim; de-duplicate.
Hard-coded display order: Cash 1, US Cash 2, Debit Card 3, Visa 4, Mastercard 5, AMEX 6, Discover 7,
Tim Card 8, Starbucks Card 9, Gift Card 10, "Onine Catering Cash" 11 (typo in source), On Account 12,
Paid Out 13, anything else 11.

## District  (hidden, load-time only)
SQL: `select * from District_Directors`, sorted by HostLocationID desc.
Used only inside the LOCATION&BRAND load (step 5). No model relationship needed.

## Date / Report / auto date tables
DAX only: CALENDAR("2019-01-01", TODAY()); Report = Row("Column", BLANK()) placeholder.

## Findings
- CORRECTION to 04_relationships.md: District IS used, at load time via a Power Query merge, not via a relationship.
- Cash Drop is merged into Cash in the data (step 7), so the cashdrop column and the Cash-CashDrop measure always
  see no "Cash Drop" rows. They are effectively dead code.
- All paid-outs are labelled "Cash", so Tender amount 2 subtracts paid-outs on the Cash row only.
- Possible mismatch to verify: Cash_Paidout builds LB_name in SQL with NO "Wendy's" -> "WENDYS" replacement,
  while LOCATION&BRAND's key is replaced. If any mapping row spells the brand "Wendy's", those paid-outs would not
  link to their store. Needs a data check, not assumed.
- Date windows differ: tenders = last 2 full years + this year; paid-outs = all history; Date table = 2019 onwards.
- Paid-outs grouped by MenuItemName (not selected), so several rows per store/day. Sums are unaffected.
- The 4 source tables match the mapping already on AG-66.
