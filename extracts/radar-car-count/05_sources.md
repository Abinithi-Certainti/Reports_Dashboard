# Radar Car Count - source queries (decoded from INFO.PARTITIONS)

The report reads from THREE databases:

| Table | Source |
|---|---|
| POS_ORDERS, Plaza, Date | SQL Server `etlsqlservercaeprd01.database.windows.net` / `ETLServerSQL` |
| Radar | **MySQL `52.138.56.151:3306` / `onroutenew`, table `smats_raw`** |

## POS_ORDERS
```sql
SELECT b.LocationName,
       count(orderid) AS ordernumber,
       cast(a.endday AS date) AS endday,
       Datepart(hour, FinishOn) AS hour_of_sale
FROM POS_ORDERS a
JOIN (SELECT DISTINCT [LocationName], [CTLocation], [ROLLOUT], [HostLocationID], [GUID], [StoreID]
      FROM [dbo].[NetSuiteLocation_Mapping]
      WHERE HostLocationID IS NOT NULL AND (ROLLOUT = 'Yes' OR ROLLOUT = 'Suspended')) b
  ON a.StoreId = b.storeid
WHERE endday >= '2022-01-01 00:15:00' AND a.OrderTypeName <> 'Cash Drop'
GROUP BY b.LocationName, cast(a.endday AS date), Datepart(hour, FinishOn)
```
Then the column `ordernumber` is renamed `OrderNumber`.

## Plaza
```sql
SELECT DISTINCT LocationName FROM NetSuiteLocation_Mapping WHERE ROLLOUT IN ('Yes', 'Suspended')
```

## Date
`dbo.date_table` joined to its first retail week per year. Kept: `Date` BETWEEN the first day of the month 12 months
ago AND yesterday. It adds retail calendar columns (retail week/period/year, start/end of week and month, labels).

## Radar (MySQL)
```sql
SELECT CASE WHEN location = 'Sensor-1' AND rec_datetime <= '2025-09-18 00:00:00' THEN 'Cambridge North'
            WHEN location = 'Inglside' THEN 'Ingleside'
            ELSE location END AS location,
       zone_name,
       CASE WHEN zone_name LIKE 'Off%' THEN 'Entrance'
            WHEN ((zone_name LIKE 'WB%' AND location IN ('Bainsville','Cambridge North','Ingersoll','Ingleside','Mallorytown North','Napanee','Newcastle','Tilbury North','Trenton North','West Lorne'))
               OR (zone_name LIKE 'NB%' AND location IN ('Barrie','King City'))
               OR (zone_name LIKE 'EB%' AND location IN ('Cambridge South','Dutton','Mallorytown South','Morrisburg','Odessa','Port Hope','Tilbury South','Trenton South','Woodstock'))
               OR (zone_name LIKE 'SB%' AND location IN ('Innisfil','Maple'))) THEN 'Highway'
            ELSE zone_name END AS new_zone_name,
       vehicle_class,
       CASE WHEN vehicle_class IN ('Car','Motorbike','Transporter') THEN 'Cars'
            WHEN vehicle_class IN ('Long Truck','Short Truck') THEN 'Trucks'
            ELSE 'UNKNOWN' END AS vehicle_group,
       SUM(volume) AS volume,
       hour(rec_datetime) AS hour_only,
       CAST(rec_datetime AS date) AS date_only,
       CASE WHEN location <> 'Sensor-1' THEN 1
            WHEN location = 'Sensor-1' AND CAST(rec_datetime AS date) < '2025-09-18' THEN 1
            WHEN location = 'Sensor-1' AND CAST(rec_datetime AS date) >= '2025-09-24' AND CAST(rec_datetime AS date) < '2025-09-29' THEN 1
            ELSE 0 END AS Include
FROM onroutenew.smats_raw
GROUP BY <location CASE>, <new_zone_name CASE without the ELSE>, vehicle_class, hour(rec_datetime), CAST(rec_datetime AS date)
HAVING Include = 1
```

## Hidden business rules found in the Radar query
1. **Direction per plaza is hard-coded**: which lane prefix (WB/EB/NB/SB) counts as "Highway" (passing traffic) is a
   fixed list of plaza names inside the SQL. A new plaza, or a renamed one, silently drops out of "Passing Traffic".
2. `Off%` zones are the entrance (cars turning in).
3. Sensor renames: `Sensor-1` is Cambridge North up to 2025-09-18; `Inglside` is a typo fixed to `Ingleside`.
4. `Sensor-1` rows after 2025-09-18 are excluded, except 2025-09-24 to 2025-09-28 - but those kept rows are still
   named `Sensor-1` (the rename only covers up to 09-18), so they match no Plaza. Needs confirming.
5. Vehicle groups: Car / Motorbike / Transporter = Cars; Long Truck / Short Truck = Trucks; anything else = UNKNOWN
   (counted in totals, not in the Cars/Trucks columns).
6. The GROUP BY copies the zone CASE **without** its `ELSE zone_name`, and `zone_name` itself is selected but not
   grouped. MySQL allows this only with ONLY_FULL_GROUP_BY off; zones that are neither Entrance nor Highway (for
   example the opposite carriageway) collapse into one group. They are not used by any measure, so totals are not
   affected, but PostgreSQL will refuse the query as written - the translation must group properly.
7. Hours come from `rec_datetime` - its time zone is not stated.
