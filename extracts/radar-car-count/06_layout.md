# Radar Car Count - layout (from the PDF export, 1 page)

Title: **ONroute - Radar Car Count**

Slicers: **Date** (range slider; export shows 2026-01-01 to 2026-01-04) and **Plaza** (dropdown, All).

One table (matrix), one row per plaza with an expand (+) button, a Total row. Columns, left to right:

| Column | Measure |
|---|---|
| Plaza | Plaza[LocationName] |
| Passing Traffic Total / Cars / Trucks | Radar_highway / _cars / _trucks |
| Entrance Cars / Trucks, Total Entrance | Radar_entrance_cars / _trucks, Radar_entrance |
| Turn In Rate Cars / Trucks, Turn In Rate | Radar_Turn_In_Cars / _Trucks, Radar_Turn_In |
| Total Transactions | transaction (yellow band) |
| Transactions from 7am to 11am, 11am to 3pm, 3pm to 10pm ... | hour-band transaction measures (yellow band) |

The table is wider than the page: it scrolls right, so columns after "Transactions 3pm to 10pm" are cut off in the
export. 17 plazas shown (Bainsville ... Tilbury North).

## Check values from the export (Total row, 2026-01-01 to 2026-01-04)
Used later to prove the new version gives the same answers.

| Passing Total | Passing Cars | Passing Trucks | Entrance Cars | Entrance Trucks | Total Entrance | Turn In Cars | Turn In Trucks | Turn In | Transactions | 7-11am | 11am-3pm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,460,808 | 1,224,300 | 236,508 | 250,155 | 22,062 | 272,228 | 16.97 % | 8.53 % | 15.71 % | 208,477 | 31,970 | 79,994 |

Arithmetic checked:
- Turn In = 272,228 / (272,228 + 1,460,808) = 15.71 %. Cars: 250,155 / (250,155 + 1,224,300) = 16.97 %. Matches.
- Passing Cars + Trucks = Total exactly. Entrance Cars + Trucks = 272,217, 11 less than Total Entrance: 11 entrance
  vehicles are in the UNKNOWN group (rule 5 in 05_sources.md).
