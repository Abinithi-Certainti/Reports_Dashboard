"""Makes demo/static-data/sales-margin-rows.json: MADE-UP daily rows for the Sales and Margin online demo.

Same columns as reports/sales-margin-budget/dataset.sql. Plaza names are real, every amount is invented.
One row per day, plaza and brand. COGS sits on the week-ending Saturday, as in weekly_cogs.
Run: python3 tools/make_sales_margin_sample.py
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(76)
PLAZAS = {  # plaza -> sample director
    "Cambridge North": "Sample Director A", "Cambridge South": "Sample Director A", "Woodstock": "Sample Director A",
    "Innisfil": "Sample Director B", "Barrie": "Sample Director B", "King City": "Sample Director B",
    "Napanee": "Sample Director C", "Odessa": "Sample Director C",
}
BRANDS = {"TIM HORTONS": 1.0, "BURGER KING": 0.55, "MARKET": 0.35}
start, end = date(2025, 12, 28), date(2026, 9, 26)

rows = []
for plaza, director in PLAZAS.items():
    size = random.uniform(0.6, 1.4)
    for brand, share in BRANDS.items():
        if brand == "MARKET" and plaza in ("Barrie", "Odessa"):
            continue
        margin = random.uniform(0.66, 0.72)
        week_sales = 0.0
        d = start
        while d <= end:
            season = 1 + 0.25 * (d.month in (6, 7, 8)) + 0.1 * (d.weekday() in (4, 5))
            net = round(4200 * size * share * season * random.uniform(0.85, 1.15), 2)
            fees = round(net * 0.004, 2) if brand == "MARKET" else 0.0
            deposits = round(net * 0.01, 2) if brand == "MARKET" else 0.0
            sales = round(net - fees - deposits, 2)
            week_sales += sales
            budget = round(sales * random.uniform(0.88, 1.06), 2)
            is_saturday = d.weekday() == 5
            cogs = round(week_sales * (1 - margin) * random.uniform(0.96, 1.04), 2) if is_saturday else 0.0
            if is_saturday:
                week_sales = 0.0
            rows.append({
                "day": d.isoformat(), "plaza": plaza, "brand": brand, "district_director": director,
                "net_sales": net, "card_fees": fees, "deposits": deposits, "sales": sales,
                "transactions": int(net / random.uniform(9, 13)), "cogs": cogs,
                "budget_sales": budget, "budget_gp": round(budget * random.uniform(0.66, 0.69), 2),
            })
            d += timedelta(days=1)

out = Path(__file__).resolve().parent.parent / "demo" / "static-data" / "sales-margin-rows.json"
out.write_text(json.dumps(rows, separators=(",", ":")))
print(f"{len(rows)} rows -> {out} ({out.stat().st_size // 1024} KB)")
