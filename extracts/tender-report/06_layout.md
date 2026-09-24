# Tender Report - page layout (from the PDF export shared 24 Sep 2026; 1 page)

Title: "Tender Report"

## Slicers (filters), all default "All"
| Slicer | Type | Field (model) |
|---|---|---|
| Plaza | dropdown | 'LOCATION&BRAND'[Plaza] |
| District Director | dropdown | 'LOCATION&BRAND'[District Director] |
| Brand | dropdown | 'LOCATION&BRAND'[Brand] |
| Payment Type | dropdown | Payment Type (Summary or PaymentType Detail - to confirm) |
| Date | range slider with from/to boxes (export shows 12/29/2024 - 1/15/2025) | 'Date'[Date] |

## Visual 1 - "Selected Locations - Summary" (table)
Columns: Payment Type | Tender amount ([Tender amount 2], $) | % to Total ([% to Total], %)
Rows sorted by payment-type sequence. Total row at bottom.

## Visual 2 - "All Locations - Detail" (matrix)
Rows: Plaza > Brand > Payment Type (expand/collapse)
Columns: each day ("Sunday, December 29, 2024" ...), horizontal scroll
Values: Tender amount, with subtotals per Plaza and Brand, and a grand Total row.

## Findings verified from the numbers in the export
1. % to Total does not add to 100%. The visible rows alone add to 108.66%.
   - Cash row divides by the grand total ($7,571,299 implied; $7,572,059.10 shown).
   - Every other row divides by the total MINUS cash ($6,524,191 = 7,572,059.10 - 1,047,867.83).
   Cause, from 03_measures.md: [Total Payment] = [All_Payment_Type ex cash] + [Cash-paidout]. On a non-cash row the
   cash part evaluates to 0, so the denominator loses the cash amount. Whether this is intended is a business question.
   AG-66 was waiting on relationships.tmdl to confirm this same calculation.
2. Payment type casing is inconsistent: "DO AMEX" in the detail matrix, "DO Amex" in the summary (also noted on AG-66).
3. Payment types not in the hard-coded order (Digital *, DO *) all get sequence 11 and sort together.
4. The summary table scrolls: visible amounts sum to $7,233,556.32 against a $7,572,059.10 total, so more rows exist below.
