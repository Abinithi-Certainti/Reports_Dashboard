# Tender Report - DAX measures (from EVALUATE INFO.VIEW.MEASURES(), 24 Sep 2026)

| ID | Measure | Home table | Hidden | Format |
|---|---|---|---|---|
| 3055 | Cash-paidout | Payment Type Summary | true | - |
| 3061 | All_Payment_Type ex cash | Payment Type Summary | true | - |
| 3064 | Total Payment | Payment Type Summary | true | $#,0.00;($#,0.00);$#,0.00 |
| 84295 | Cash-CashDrop | Payment Type Summary | true | - |
| 96024 | Tender amount 2 | Report | false | $#,0.00;($#,0.00);$#,0.00 |
| 96285 | % to Total | Report | false | 0.00%;-0.00%;0.00% |
| 2404551 | Debug Total Payment | Report | false | - |

## Expressions

### Cash-paidout
```
var cash_payment = CALCULATE(SUM('Payment Type Summary'[Tender Amount]),FILTER('Payment Type Summary', 'Payment Type Summary'[Payment Type] = "Cash"))
var paidout_cash = CALCULATE(SUM(Cash_Paidout[PaymentAmount]))
return cash_payment-paidout_cash
```

### All_Payment_Type ex cash
```
var cashfilter = CALCULATETABLE('Payment Type Summary', 'Payment Type Summary'[Payment Type] <> "Cash", ALL('Payment Type Summary'[sequence 2]))
return CALCULATE(SUM('Payment Type Summary'[Tender Amount]),cashfilter)
```

### Total Payment
```
[All_Payment_Type ex cash]+[Cash-paidout]
```

### Cash-CashDrop
```
CALCULATE(sum('Payment Type Summary'[Tender Amount]),'PaymentType Detail'[PaymentTypeName]="Cash")+CALCULATE(SUM('Payment Type Summary'[Tender Amount]),'PaymentType Detail'[PaymentTypeName]="Cash Drop")
```

### Tender amount 2
```
sum('Payment Type Summary'[Tender Amount])-sum(Cash_Paidout[PaymentAmount])
```

### % to Total
```
DIVIDE([Tender amount 2], [Total Payment])
```

### Debug Total Payment
```
[Total Payment]
```

## Plain-English reading (to confirm)
- Total Payment = every tender amount, minus cash paid-outs. "Cash Drop" is NOT excluded (only "Cash" is split out), so it is counted in the total.
- Tender amount 2 = tender amount minus paid-outs, in whatever row it is shown. Whether paid-outs are split per payment type depends on the relationships (next query).
- % to Total = Tender amount 2 / Total Payment.
- Cash-CashDrop is named with a minus but ADDS Cash and Cash Drop. Hidden; may be unused.
- Debug Total Payment is a visible copy of Total Payment; looks like a leftover. Confirm whether any visual uses it.
