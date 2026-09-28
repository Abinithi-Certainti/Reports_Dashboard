# Radar Car Count - measures (all stored on table `report data`)

Pattern: every measure is a filtered SUM. Names below are grouped; the DAX is exactly as extracted.

## Transactions (POS_ORDERS, OrderNumber = count of orders per plaza/day/hour)
| Measure | DAX |
|---|---|
| transaction | `SUM(POS_ORDERS[OrderNumber])` |
| Transactions from 7am to 11am | `CALCULATE(SUM(POS_ORDERS[OrderNumber]), FILTER('POS_ORDERS', hour_of_sale >= 7 && hour_of_sale < 11), 'Date'[Date])` |
| Transactions from 11am to 3pm | same, `>= 11 && < 15` |
| Transactions from 3pm to 10pm | same, `>= 15 && < 22` |
| Transactions from 10pm to 7am | `hour_of_sale < 7` + `hour_of_sale > 21` |

## Radar volume (Radar[volume])
| Measure | Filter |
|---|---|
| Radar_highway / Radar_entrance | new_zone_name = "Highway" / "Entrance" |
| Radar_highway_cars / _trucks, Radar_entrance_cars / _trucks | plus vehicle_group = "Cars" / "Trucks" |
| Radar_hwy_07_to_11, _11_to_15, _15_to_22 (and _cars / _trucks) | Highway + hour_only band [7,11), [11,15), [15,22) |
| Radar_ent_07_to_11, _11_to_15, _15_to_22 (and _cars / _trucks) | Entrance + same hour bands |
| Radar_hwy_22_to_07 (and _cars / _trucks) | Radar_highway minus the three day bands |
| Radar_ent_22_to_07 (and _cars / _trucks) | Radar_entrance minus the three day bands |

## Turn-in rate (percent, format `0.00 %`)
| Measure | DAX |
|---|---|
| Radar_Turn_In | `[Radar_entrance] / ([Radar_entrance] + [Radar_highway])` |
| Radar_Turn_In_Cars / _Trucks | same with the _cars / _trucks measures |
| TurnIn_07_to_11 ... TurnIn_22_to_07 (and _cars / _trucks) | same per hour band |

Total: 5 transaction measures, 45 radar / turn-in measures (50 in all).
