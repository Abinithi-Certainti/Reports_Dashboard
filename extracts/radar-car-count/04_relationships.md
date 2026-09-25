# Radar Car Count - relationships (active, single direction)

| From (many) | To (one) |
|---|---|
| POS_ORDERS[LocationName] | Plaza[LocationName] |
| POS_ORDERS[endday] | Date[Date] |
| Radar[location] | Plaza[LocationName] |
| Radar[date_only] | Date[Date] |

Plus 8 relationships from Date columns to Power BI's hidden auto date tables (internal, not needed).
Radar and orders meet only through Plaza and Date: the Plaza slicer and the Date slicer filter both.
