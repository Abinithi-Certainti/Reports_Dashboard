# People Count & Transaction - tables (from INFO.VIEW.TABLES / INFO.COLUMNS)

| Table | Source | Columns used |
|---|---|---|
| WAIV | MySQL `onroutenew.people_count` (daily cumulative camera counts) | Plaza, camera_channel, ServerDate, people_in, people_in_before_7 / _11 / _15 / _22 (+ derived 15 minutes, Hour, Year, Year_) |
| WAIV_hourly | MySQL `onroutenew.people_count` (per hour) | Plaza, camera_channel, ServerDate, people_in_time, Hour, people_in (cumulative), people_in_count (in that hour) |
| POS_ORDERS | SQL Server `ETLServerSQL` POS_ORDERS | LocationName, OrderNumber (= count of orders), endday, hour_of_sale |
| Location | MySQL `onroutenew.ip_camera` | LocationName (= distinct `center`) |
| Date | DAX `CALENDAR(Date(2021,1,1), TODAY())` | Date, start of month, Year, Month, day, sort_day, WeekdayName, WeekdayNumber |
| Hour | DAX `GENERATESERIES(0, 23)` | Hour, HourText, Hour Range ("00:00 - 01:00") |
| report data | empty holder for measures | - |

## Relationships (all active, single direction)
| From (many) | To (one) |
|---|---|
| WAIV[ServerDate], POS_ORDERS[endday], WAIV_hourly[ServerDate] | Date[Date] |
| WAIV[Plaza], POS_ORDERS[LocationName], WAIV_hourly[Plaza] | Location[LocationName] |
| POS_ORDERS[hour_of_sale], WAIV_hourly[hour] | Hour[Hour] |
