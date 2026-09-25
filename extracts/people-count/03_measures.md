# People Count & Transaction - measures (28)

## People in (camera counts are CUMULATIVE per camera per day, so bands are differences)
| Measure | DAX (short) |
|---|---|
| Waiv Data In | `SUM(WAIV[people_in])` - end-of-day count |
| Waiv Data In from 7am to 11am | `IF(SUM(before_11)=0, 0, SUM(before_11) - SUM(before_7))` |
| Waiv Data In from 11am to 3pm | `IF(SUM(before_15)=0, 0, SUM(before_15) - SUM(before_11))` |
| Waiv Data In from 3pm to 10pm | `IF(SUM(before_22)=0, 0, SUM(before_22) - SUM(before_15))` |
| Waiv Data in from 10pm to 7am | `[Waiv Data In] - SUM(before_22) + SUM(before_7)` |
| People In from ... (4 bands) | `SUMX(CROSSJOIN(VALUES(Location), VALUES(Date)), [Waiv Data In from ...])` - worked out per plaza per day, then added |
| people in sum | the 4 People In bands added, per plaza per day |
| OLD Waiv Data In ... (4) | earlier versions (zero if either SUM is 0) - not on the page |

## Transactions
| Measure | DAX |
|---|---|
| transaction | `SUM(POS_ORDERS[OrderNumber])` |
| Transaction from 7am to 11am / 11am to 3pm / 3pm to 10pm | hour_of_sale in [7,11) / [11,15) / [15,22) |
| Transaction from 10pm to 7am | transaction minus the three day bands |

## Capture rate (transactions / people in, format 0.00%)
| Measure | DAX |
|---|---|
| Capture  Rate | `DIVIDE([transaction], [people in sum])` |
| 7am - 11am ... 10pm - 7am Capture Rate | `DIVIDE([Transaction from X], [People In from X])` |

## Hourly page (table WAIV_hourly)
| Measure | DAX |
|---|---|
| Transactions | `SUM(POS_ORDERS[OrderNumber])` |
| People In Hourly | `SUM(WAIV_hourly[people_in_count])` |
| Capture Rate | `DIVIDE([Transactions], [People In Hourly])` |
