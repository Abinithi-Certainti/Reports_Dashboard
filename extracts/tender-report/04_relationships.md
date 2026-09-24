# Tender Report - relationships (from EVALUATE INFO.VIEW.RELATIONSHIPS(), 24 Sep 2026)
# All active. Auto date-table link (Date -> LocalDateTable) omitted.

| From (many side) | To (one side) | Filter direction |
|---|---|---|
| 'Payment Type Summary'[LB_name] | 'LOCATION&BRAND'[LOCATIONID&BRAND] | One direction |
| 'Payment Type Summary'[endday] | 'Date'[Date] | One direction |
| 'Payment Type Summary'[Payment Type] | 'PaymentType Detail'[PaymentTypeName] | BOTH directions |
| 'Cash_Paidout'[LB_name] | 'LOCATION&BRAND'[LOCATIONID&BRAND] | One direction |
| 'Cash_Paidout'[endday] | 'Date'[Date] | One direction |
| 'Cash_Paidout'[PaymentTypeName] | 'PaymentType Detail'[PaymentTypeName] | One direction |

## Shape
Star model. Two fact tables: Payment Type Summary (tenders) and Cash_Paidout (paid-outs).
Three shared lookup tables: LOCATION&BRAND, Date, PaymentType Detail.

## Findings
- Paid-outs are filtered by payment type, so "Tender amount 2" subtracts paid-outs only on the
  row of their own payment type, not on every row. Answers the open question from 03_measures.md.
- The District table has NO relationship. It cannot filter anything. Likely unused; confirm no visual uses it.
- LOCATION&BRAND already carries "District Director", so District may be redundant.
- Joins use text keys (LB_name = LOCATIONID&BRAND, and payment type names). hostlocationid is not used in any join.
- 6 relationships matches the count recorded on AG-66.
