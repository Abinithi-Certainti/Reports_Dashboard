"""Fill the MOCK source database (old SQL Server tables) with made-up rows: 6 stores, 2 weeks, plus a few rows that
are broken on purpose, one per rule in the schema review. Test only - never point this at a real database.

    python3 mock/make_fake_data.py            (connection from the SRC_* settings, see migrate.py)

Every broken row is listed in EXPECTED_ERRORS below, so the test can check the migration catches exactly these.
"""
import datetime as dt
import os
import random
import uuid

import pymssql

random.seed(7)
D0 = dt.date(2026, 9, 6)                      # Sunday; two retail weeks: 6-19 Sep 2026
DAYS = [D0 + dt.timedelta(days=i) for i in range(14)]
STORES = [  # store id, location id, plaza, brand, host location, ct location, rollout
    ("101518", 1, "Dutton ON S", "Tim Hortons", 4001, "TIM23", "Yes"),
    ("101519", 2, "Dutton ON S", "Market", 4001, "MKT23", "Yes"),
    ("101601", 3, "Odessa ON S", "Tim Hortons", 4002, "TIM31", "Yes"),
    ("101602", 4, "Odessa ON S", "Wendy's", 4002, "WEN31", "Suspended"),
    ("101701", 5, "Barrie ON S", "Market", 4003, "MKT40", "Yes"),
    ("101702", 6, "Barrie ON S", "Subway", 4003, "SUB40", "No"),
]
# The real values, as in DEV's master.order_type_name_enum (checked 2026-10-05). Orders use the first six.
ORDER_TYPES = ["Take Out", "Drive-Thru", "Digital Order", "Eat In", "Mobile - Take Out", "Mobile - Drive Thru", "Cash Drop", "Paid Out"]
EXPECTED_ERRORS = {  # source table -> number of rows that must be rejected (each has one broken value)
    "POS_ORDERS": 4,          # empty StoreId, bad GUID, unknown OrderTypeName 'Catering', IsRefund 'maybe'
    "POS_ORDERDETAILS": 2,    # empty GUID, HasMods 'perhaps'
    "POS_ORDERPAYMENTS": 1,   # empty StoreId
    "POS_ORDERPAIDOUTS": 1,   # OrderTypeName 'Catering'
    "WeeklyCogs": 2,          # loc_code longer than 20 characters, empty period
    "WeeklyCogsProdNum": 2,   # duplicate product_num, empty category
    "EmployeePaySummaryV2": 2,  # EmployeeName longer than 100 characters, empty PayDate
    "date_table": 1,          # empty Date
}
EXPECTED_WARNINGS = {"WeeklyCogs": 1}  # one period with a time of day (13:00): converted, time dropped


def conn():
    return pymssql.connect(server=os.environ.get("SRC_HOST", "127.0.0.1"), port=int(os.environ.get("SRC_PORT", "1433")),
                           user=os.environ["SRC_USER"], password=os.environ["SRC_PASSWORD"],
                           database=os.environ["SRC_DATABASE"], autocommit=False)


def insert(cur, table, rows):
    if not rows:
        return
    cols = list(rows[0].keys())
    cur.executemany(f"INSERT INTO dbo.[{table}] ({', '.join(f'[{c}]' for c in cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
                    [tuple(r[c] for c in cols) for r in rows])
    print(f"  {table:30} {len(rows):6} rows")


def money(lo, hi):
    return round(random.uniform(lo, hi), 2)


def main():
    c = conn(); cur = c.cursor()
    for t in ["POS_ORDERDETAILS", "POS_ORDERPAYMENTS", "POS_ORDERPAIDOUTS", "POS_ORDERS", "WeeklyCogs", "WeeklyCogsProdNum",
              "EmployeePaySummaryV2", "Temp_DLH", "date_table", "District_Directors", "NetSuiteLocation_Mapping",
              "Sales_2026_UnPivot_New", "GM_2026_UnPivot_New", "Transactions_2026_UnPivot_v2", "DLH_2026_UnPivot_New"]:
        cur.execute(f"DELETE FROM dbo.[{t}]")

    # Lookups. NetSuiteLocation_Mapping.LocationID is an IDENTITY column: let SQL Server number it.
    insert(cur, "NetSuiteLocation_Mapping", [dict(
        PreAcquisition=None, PostAcquisition=None, AcquitsionDate=dt.datetime(2020, 1, 1), Company="ONroute",
        Location=ct, LocationName=plaza, Brand=brand[:3].upper(), BrandName=brand, CTLocation=ct, CTBrand=brand[:3].upper(),
        NSDeptID=100 + loc, ROLLOUT=roll, HostLocationID=host, GUID=str(uuid.uuid4()), StoreID=sid, brand_w_DT=0, no_of_type=1)
        for sid, loc, plaza, brand, host, ct, roll in STORES])
    insert(cur, "District_Directors", [dict(Plaza=p, District=d, District_Director=dd, HostLocationID=h)
                                       for p, d, dd, h in [("Dutton", "West", "Ontario West", 4001), ("Odessa", "East", "Ontario East", 4002),
                                                           ("Barrie", "Central", "GTA Central", 4003)]])
    cal = []
    for i in range(-400, 120):
        d = D0 + dt.timedelta(days=i)
        sun = d - dt.timedelta(days=(d.weekday() + 1) % 7)
        cal.append({"day_id": 20000 + i, "Date": d, "Week": int(d.strftime("%U")), "Month": d.month, "Year": d.year,
                    "Day_of_Month": d.day, "Day of_Week": (d.weekday() + 1) % 7 + 1, "Weekday": d.strftime("%A"),
                    "Start_of_Week": sun, "End_of_Week": sun + dt.timedelta(days=6), "Retail_Week_of_Year": int(sun.strftime("%U")) + 1,
                    "Retail_Period": (sun.month - 1) % 12 + 1, "Retail_Year": sun.year, "Retail_Period_Start_Date": sun.replace(day=1),
                    "Retail_Period_End_Date": sun.replace(day=28)})
    cal.append({**cal[0], "day_id": 99999, "Date": None})                     # broken: empty Date
    insert(cur, "date_table", cal)

    # POS: orders, details, payments, paid-outs
    orders, details, pays, paidouts = [], [], [], []
    oid = 500000
    for sid, *_ in STORES:
        for d in DAYS:
            for _ in range(12):
                oid += 1
                net = money(4, 40); tax = round(net * 0.13, 2); ot = random.choice(ORDER_TYPES[:6])
                t = dt.datetime.combine(d, dt.time(random.randint(6, 21), random.randint(0, 59)))
                g = str(uuid.uuid4())
                orders.append(dict(OrderID=oid, StartOn=t, FinishOn=t, OrderTypeName=ot, OrderType=ORDER_TYPES.index(ot), Tax=tax,
                                   SubTotal=net, GrandTotal=net + tax, Total=net + tax, Discount=0, ComboSaved=0, IsRefund="False",
                                   Endday=dt.datetime.combine(d, dt.time()), Gross=net, Net=net, ReceiptNumber=oid % 10000,
                                   OrderNumberID=oid % 1000, StartPerson="Crew", ClosePerson="Crew", StartPersonEmployeeID=1,
                                   ClosePersonEmployeeID=1, Third_Party_OrderID=None, TargetComputer="POS1", GUID=g, StoreId=sid))
                for k in range(1, 4):
                    price = money(1, 12)
                    details.append(dict(OrderDetailID=k, OrderID=oid, MenuItemID=1000 + k, MenuItemName=f"Item {k}", KitchenName="Kitchen",
                                        MenuItemType="Item", PLU=str(2000 + k), Price=price, Quantity=1, DepartmentID=10 + k,
                                        DepartmentName=["Coffee", "Food", "Gift Card"][k - 1], DiscountID=None, DiscountValue=0,
                                        Discountamount=0, HasMods=random.choice(["Y", "N"]), Sequence=k, EnteredTime=t,
                                        TaxExemption="False", TaxQuantity=1, Deposit="0", ValueAddedBasePrice=price,
                                        ComboDiscountedPrice=0, ALCPrice=0, ALCMaxPrice=0, ALCRemainingPrice=0, PricingGroupPLU=None,
                                        PricingGroupName=None, UpgradeAmount=0, ComboPercentBasedPrice=0, ComboPercentBasedDiscountPrice=0,
                                        OrderTypeName=ot, OrderType=ORDER_TYPES.index(ot), FinishOn=t, Endday=dt.datetime.combine(d, dt.time()),
                                        DiscountType=None, PriceBackUP=price, MaxOrderDetailID=3, PersistentPLU=2000 + k,
                                        GUID=str(uuid.uuid4()), StoreId=sid))
                pays.append(dict(OrderID=oid, FinishOn=t, Endday=dt.datetime.combine(d, dt.time()), PaymentTypeID=1,
                                 PaymentAmount=round(net + tax, 2), Gratuity=0, PennyRounded=0, UsePennyRounding="True",
                                 ExchangeRate=1, PaymentTypeName=random.choice(["Cash", "Visa", "Debit Card"]), GUID=str(uuid.uuid4()), StoreId=sid))
            paidouts.append(dict(OrderDetailID=1, OrderID=oid, MenuItemID=900, MenuItemName="Paid Out: lotto win", EnteredTime=t,
                                 OrderTypeName="Paid Out", OrderType=ORDER_TYPES.index("Paid Out"), FinishOn=t, EndDay=dt.datetime.combine(d, dt.time()),
                                 PaymentAmount=money(5, 50), GUID=str(uuid.uuid4()), StoreId=sid))
    # broken on purpose
    orders[0]["StoreId"] = None
    orders[1]["GUID"] = "not-a-guid"
    orders[2]["OrderTypeName"] = "Catering"
    orders[3]["IsRefund"] = "maybe"
    orders[4]["IsRefund"] = ""            # empty flag -> NULL, allowed
    details[0]["GUID"] = None
    details[1]["HasMods"] = "perhaps"
    pays[0]["StoreId"] = None
    paidouts[0]["OrderTypeName"] = "Catering"
    for t, rows in [("POS_ORDERS", orders), ("POS_ORDERDETAILS", details), ("POS_ORDERPAYMENTS", pays), ("POS_ORDERPAIDOUTS", paidouts)]:
        insert(cur, t, rows)

    # COGS: 3 products x 6 locations x 2 weeks. WeeklyCogs_ID and WeeklyCogsProdNum_ID are IDENTITY columns.
    products = [("P100", "Coffee beans", "Beverage", "Hot"), ("P200", "Chips", "Snack Food", "Salty"), ("P300", "Gum", "Candy/Gum/Mints", "Gum")]
    prod_rows = [dict(product_name=n, product_num=p, category=c, sub_category=s, micro_category=None, inv_unit="EA") for p, n, c, s in products]
    prod_rows.append(dict(product_name="Coffee beans (copy)", product_num="P100", category="Beverage", sub_category="Hot", micro_category=None, inv_unit="EA"))
    prod_rows.append(dict(product_name="Mystery", product_num="P999", category=None, sub_category="?", micro_category=None, inv_unit="EA"))
    insert(cur, "WeeklyCogsProdNum", prod_rows)
    cogs = []
    for _, _, _, _, _, ct, _ in STORES:
        for wk in (dt.datetime(2026, 9, 12), dt.datetime(2026, 9, 19)):
            for p, *_ in products:
                begin = money(100, 500); buy = money(50, 300); end = money(80, 400); waste = money(0, 20)
                cogs.append(dict(loc_code=ct, Start_Date=wk - dt.timedelta(days=6), period=wk, product_num=p, unit_price=money(1, 9),
                                 begin_quantity=10.0, begin_value=begin, purchase_quantity=5.0, purchase_value=buy, inv_adj_quantity=0.0,
                                 inv_adj_value=waste, waste_quantity=1.0, waste_value=0.0, var_adj_quantity=0.0, var_adj_value=0.0,
                                 transfer_out_quantity=0.0, transfer_out_value=0.0, end_quantity=8.0, end_value=end,
                                 cogs=round(begin + buy - end, 6), createdate=dt.datetime(2026, 9, 21, 3, 0), theo_depletion=1.0, theo_cost=2.0))
    cogs[0]["loc_code"] = "A-LOCATION-CODE-THAT-IS-TOO-LONG"     # broken: longer than 20
    cogs[1]["period"] = None                                      # broken: empty period
    cogs[2]["period"] = dt.datetime(2026, 9, 12, 13, 0)           # warning: time of day
    insert(cur, "WeeklyCogs", cogs)

    # Labour
    pay = []
    for sid, loc, plaza, brand, *_ in STORES:
        for d in DAYS:
            for job in ["CREW MEMBER", "SHIFT SUPERVISOR"]:
                pay.append(dict(EmployeeNumber=f"E{loc}{job[:2]}", EmployeeName=f"Employee {loc}", PayDate=dt.datetime.combine(d, dt.time()),
                                Location=f"{plaza} {brand}".upper(), Department="Crew", Job=job, AuthorizedManager="Mgr", AuthorizedEmployee="Emp",
                                PayCode="Reg", PayCategory="Reg", Hours=round(random.uniform(4, 9), 2), Rounded_In_Out="08:00-16:00",
                                PayAmount=money(60, 160), Retrieve_Date=dt.datetime(2026, 9, 21, 2, 30)))
    pay[0]["EmployeeName"] = "X" * 120                            # broken: longer than 100
    pay[1]["PayDate"] = None                                      # broken: empty PayDate
    insert(cur, "EmployeePaySummaryV2", pay)
    insert(cur, "Temp_DLH", [dict(Plaza=p.replace(" ON S", ""), Brand=b, DLH_Date=d, DLH=round(random.uniform(0, 6), 2))
                             for _, _, p, b, *_ in STORES[:2] for d in DAYS])

    # Budgets (2026): one row per day, location, brand
    for t, lo, hi in [("Sales_2026_UnPivot_New", 300, 900), ("GM_2026_UnPivot_New", 100, 400),
                      ("Transactions_2026_UnPivot_v2", 30, 120), ("DLH_2026_UnPivot_New", 10, 40)]:
        rows = []
        for sid, loc, plaza, brand, host, *_ in STORES:
            for d in DAYS:
                r = dict(Region="Ontario", Location=plaza, Brand=brand, value=round(random.uniform(lo, hi), 3),
                         TimePeriod=d.strftime("%Y-%m-%d"), TimePeriod_Date=d, HostLocationID=host)
                if t in ("Transactions_2026_UnPivot_v2", "DLH_2026_UnPivot_New"):
                    r["TimePeriod"] = d
                rows.append(r)
        insert(cur, t, rows)
    c.commit()
    print("mock source filled. Broken rows on purpose:", EXPECTED_ERRORS)


if __name__ == "__main__":
    main()
