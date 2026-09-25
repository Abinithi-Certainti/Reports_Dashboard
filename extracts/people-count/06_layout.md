# People Count & Transaction - layout (PDF export, 2 pages)

## Page 1 - "ONroute - People Count & Transaction"
Slicers: Date range (export: 2025-04-01 to 2025-04-21), Plaza (All).
Matrix, one row per plaza (expandable), sorted by In ascending, with Total. Columns:
In | Capture Rate | 7am-11am | Capture Rate | 11am-3pm | Capture Rate | 3pm-10pm | Capture Rate | 10pm-7am | Capture Rate |
Total transactions | 7am-11am | 11am-3pm | ... (cut off on the right). Blue band = people, grey = transactions.

## Page 2 - "ONroute - Hourly People Count & Transaction"
Slicers: Date range, Day of Week (All), Plaza (All).
Matrix: rows = plaza, column groups = Hour Range (00:00 - 01:00 ... ), each with In | Transactions | Capture Rate.

## Check values (Total rows, 2025-04-01 to 2025-04-21)
| Page 1 | In | Capture | 7-11 In | 11-3 In | 3-10 In | 10-7 In | Transactions | 7-11 Tx |
|---|---|---|---|---|---|---|---|---|
| Total | 1,839,964 | 51.09 % | 360,989 | 603,549 | 688,818 | 186,608 | 940,028 | 173,058 |

| Page 2 | 00-01 In | 00-01 Tx | 00-01 Capture |
|---|---|---|---|
| Total | 16,404 | 9,123 | 55.61 % |

Arithmetic checked: 940,028 / 1,839,964 = 51.09 %; 9,123 / 16,404 = 55.61 %; the four people bands add up to
1,839,964 exactly. Matches.
