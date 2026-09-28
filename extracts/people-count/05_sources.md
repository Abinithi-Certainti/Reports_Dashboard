# People Count & Transaction - source queries (decoded from INFO.PARTITIONS)

## WAIV (MySQL onroutenew)
```sql
SELECT da.location AS Plaza, da.camera_channel, da.peopleindate AS ServerDate, da.people_in,
       da.people_in_before_7, da.people_in_before_11, da.people_in_before_15, da.people_in_before_22
FROM (SELECT location, camera_channel, cast(timestamp AS date) AS peopleindate,
             max(CASE WHEN Date_Format(timestamp,'%H') > 1  THEN entrance_count ELSE 0 END) AS people_in,
             max(CASE WHEN Date_Format(timestamp,'%H') < 7  THEN entrance_count ELSE 0 END) AS people_in_before_7,
             max(CASE WHEN Date_Format(timestamp,'%H') < 11 THEN entrance_count ELSE 0 END) AS people_in_before_11,
             max(CASE WHEN Date_Format(timestamp,'%H') < 15 THEN entrance_count ELSE 0 END) AS people_in_before_15,
             max(CASE WHEN Date_Format(timestamp,'%H') < 22 THEN entrance_count ELSE 0 END) AS people_in_before_22
      FROM people_count
      GROUP BY location, camera_channel, cast(timestamp AS date)) AS da
/* commented out: a join that kept only days where EVERY camera of the plaza reported
   (count(distinct camera_channel) >= peoplecount_location.total_cam) */
```
Then Power Query renames 25 plaza names by hand, e.g. `Port Hope Plaza` -> `Port Hope`, `Cambridge N Plaza` ->
`Cambridge North`, `Napanee Main Plaza` -> `Napanee`, `Trenton S Plaza` -> `Trenton South`.

## WAIV_hourly (MySQL onroutenew)
```sql
WITH hourly_data AS (
    SELECT location AS Plaza, camera_channel, CAST(timestamp AS DATE) AS ServerDate, DAYNAME(timestamp) AS day_name,
           HOUR(timestamp) AS hour, MAX(entrance_count) AS people_in_hour
    FROM people_count
    WHERE NOT (HOUR(timestamp) = 0 AND MINUTE(timestamp) < 15)
    GROUP BY location, camera_channel, CAST(timestamp AS DATE), DAYNAME(timestamp), HOUR(timestamp))
SELECT Plaza, camera_channel, ServerDate, day_name, hour, people_in_hour,
       COALESCE(people_in_hour - LAG(people_in_hour) OVER (PARTITION BY Plaza, camera_channel, ServerDate ORDER BY hour),
                people_in_hour) AS people_in_hour_along
FROM hourly_data
```
Then plaza names are cleaned by pattern (` Main`, ` N Plaza` -> ` North`, ` S Plaza` -> ` South`, ` Plaza`).

## POS_ORDERS (SQL Server) - NOT the same filter as the Radar Car Count report
```sql
WITH LOC AS (SELECT DISTINCT LocationName, ROLLOUT, StoreID FROM dbo.NetSuiteLocation_Mapping
             WHERE HostLocationID IS NOT NULL AND (ROLLOUT = 'Yes' OR ROLLOUT = 'Suspended'))
SELECT b.LocationName, COUNT(orderid) AS ordernumber, CAST(a.endday AS date) AS endday, DATEPART(hour, FinishOn) AS hour_of_sale
FROM POS_ORDERS a JOIN LOC b ON a.StoreId = b.storeid
WHERE Endday >= '2022-01-01 00:15:00'
  AND a.OrderTypeName NOT IN ('Cash Drop', 'Drive-Thru', 'Paid Out', 'Mobile - Drive Thru')
  AND a.ReceiptNumber <> 0
GROUP BY b.LocationName, cast(a.endday AS date), Datepart(hour, FinishOn)
```

## Location (MySQL)
`SELECT DISTINCT center AS LocationName FROM onroutenew.ip_camera ORDER BY center`

## Hidden rules and findings
1. **Camera counters are cumulative through the day**; a time band = counter at its end minus counter at its start.
2. **"Transactions" means two different things in two reports.** Here it leaves out Drive-Thru, Mobile - Drive Thru,
   Paid Out and receipt 0 (people walking in don't use the drive-thru); the Radar report only leaves out Cash Drop.
   Same name, different number - the new engine should give them different names.
3. Plaza names are fixed with ~25 hand-written text replaces (people_count) and a second, pattern-based set
   (hourly). A plaza lookup table would replace both.
4. The check that every camera of a plaza reported that day is **commented out**: a day with a camera offline
   counts fewer people, which pushes the capture rate up. Worth confirming this is intended.
5. The hourly page skips readings from 00:00-00:15 (counter reset window, probably).
6. Band measures return 0 when the band's end counter is 0 (camera not reporting), but "10pm to 7am" has no such guard.
7. `people_in` takes readings from hour 02 on (`'%H' > 1`), and time zone of `timestamp` is not stated.
8. 4 "OLD ..." measures are leftovers, not used on the page.
