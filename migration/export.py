"""Export the old SQL Server tables to files: one file per table and month, each with a receipt. Read only.

    python3 export.py --env export.env --out export --workers 4             # all tables in mapping.json
    python3 export.py --env export.env --out export --tables POS_ORDERS     # some tables
    python3 export.py --env export.env --out export --extra Sales_2025_UnPivot_New:TimePeriod_Date

For every piece (a table's month, its rows with an empty date, or a whole small table):
  <out>/<table>/<piece>.tsv.gz    the rows, in Postgres COPY text format (tab between values, \\N for empty), gzip
  <out>/<table>/<piece>.json      the receipt: rows written, the row count and amount totals calculated by SQL Server
                                  itself, the file's size and sha256 checksum, and the columns
<out>/_tables.json holds every table's columns and SQL Server types; load_raw.py creates the copy tables from it.

The receipt is written last, so a piece without one was not finished; a re-run skips finished pieces and redoes the
rest. Months up to --to only (default: yesterday), so a month that is still filling is never half exported.
Settings: SRC_* in the env file (see config.example.env). Never commit the output: it is real data.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import multiprocessing
import os
import sys
import time
import uuid
from concurrent.futures import ProcessPoolExecutor, as_completed
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
FORMAT = "bi-export/1"
SUM_TYPES = {"decimal", "numeric", "money", "smallmoney", "int", "bigint", "smallint", "tinyint"}   # exact types only
ESCAPE = str.maketrans({"\\": "\\\\", "\t": "\\t", "\n": "\\n", "\r": "\\r", "\x00": ""})


def load_env(path):
    env = dict(os.environ)
    if path:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def connect(env):
    import pymssql
    return pymssql.connect(server=env["SRC_HOST"], port=int(env.get("SRC_PORT", "1433")), user=env["SRC_USER"],
                           password=env["SRC_PASSWORD"], database=env["SRC_DATABASE"], login_timeout=30)


# ---------------------------------------------------------------- one value -> Postgres COPY text
def _text(v):
    return v.translate(ESCAPE)


def _dt(v):
    return v.isoformat(sep=" ")


FMT = {str: _text, int: str, Decimal: str, float: repr, bool: lambda v: "t" if v else "f",
       dt.datetime: _dt, dt.date: dt.date.isoformat, dt.time: dt.time.isoformat, uuid.UUID: str,
       bytes: lambda v: "\\\\x" + v.hex(), bytearray: lambda v: "\\\\x" + bytes(v).hex()}


def line(row):
    out = []
    for v in row:
        if v is None:
            out.append("\\N")
        else:
            f = FMT.get(type(v))
            out.append(f(v) if f else _text(str(v)))
    return "\t".join(out) + "\n"


class HashingWriter:
    """Passes bytes to a file and keeps their sha256 and count, so the checksum costs no second read."""
    def __init__(self, f):
        self.f, self.h, self.n = f, hashlib.sha256(), 0

    def write(self, b):
        self.h.update(b)
        self.n += len(b)
        return self.f.write(b)

    def flush(self):
        self.f.flush()


# ---------------------------------------------------------------- planning
def describe(conn, table):
    cur = conn.cursor()
    cur.execute("""SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
                   FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION""",
                (table,))
    cols = [{"name": n, "type": t.lower(), "length": ln, "precision": p, "scale": s, "nullable": nl == "YES"}
            for n, t, ln, p, s, nl in cur.fetchall()]
    if not cols:
        sys.exit(f"table dbo.{table} not found on the source")
    return cols


def month_starts(lo, hi):
    m = dt.date(lo.year, lo.month, 1)
    while m <= hi:
        yield m
        m = dt.date(m.year + (m.month == 12), m.month % 12 + 1, 1)


def plan(conn, table, col, date_from, date_to, explicit_range):
    """[(piece, where, params)] for one table: one per month of col up to date_to, then the rows where col is empty."""
    if not col:
        return [("all", "", ())]
    cur = conn.cursor()
    cur.execute(f"SELECT MIN([{col}]), MAX([{col}]) FROM dbo.[{table}]")
    lo, hi = cur.fetchone()
    pieces = []
    if lo is not None:
        lo = lo.date() if isinstance(lo, dt.datetime) else lo
        hi = hi.date() if isinstance(hi, dt.datetime) else hi
        lo, hi = max(lo, date_from) if date_from else lo, min(hi, date_to)
        for m in month_starts(lo, hi):
            nxt = dt.date(m.year + (m.month == 12), m.month % 12 + 1, 1)
            a, b = max(m, lo), min(nxt, hi + dt.timedelta(days=1))
            pieces.append((m.strftime("%Y-%m"), f"WHERE [{col}] >= %s AND [{col}] < %s", (a, b)))
    if not explicit_range:
        pieces.append(("empty-date", f"WHERE [{col}] IS NULL", ()))
    return pieces


# ---------------------------------------------------------------- one piece (runs in a worker process)
_CONN = {}


def export_piece(env, out, table, cols, piece, where, params, chunk_col, level):
    folder = Path(out) / table
    data, receipt = folder / f"{piece}.tsv.gz", folder / f"{piece}.json"
    if receipt.exists() and data.exists():
        done = json.loads(receipt.read_text())
        if done.get("count_matches") and done.get("bytes") == data.stat().st_size:
            return {"table": table, "piece": piece, "skipped": True}
    folder.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            if "c" not in _CONN:
                _CONN["c"] = connect(env)
            return _export(_CONN["c"], table, cols, piece, where, params, chunk_col, level, data, receipt)
        except Exception as e:                           # connection lost or timed out: reconnect and redo the piece
            try:
                _CONN.pop("c").close()
            except Exception:
                pass
            if attempt == 2:
                raise
            print(f"  {table} {piece}: {type(e).__name__}, trying again", flush=True)
            time.sleep(5 * (attempt + 1))


def _export(conn, table, cols, piece, where, params, chunk_col, level, data, receipt):
    t0 = time.time()
    names = ", ".join(f"[{c['name']}]" for c in cols)
    sum_cols = [c["name"] for c in cols if c["type"] in SUM_TYPES]
    cur = conn.cursor()
    # the receipt's numbers come from SQL Server itself, separately from the rows written to the file
    sums_sql = "".join(f", SUM(CAST([{c}] AS DECIMAL(38, 6)))" for c in sum_cols)
    cur.execute(f"SELECT COUNT_BIG(*){sums_sql} FROM dbo.[{table}] {where}", params)
    agg = cur.fetchone()
    count, sums = agg[0], {c: (None if v is None else str(v)) for c, v in zip(sum_cols, agg[1:])}
    part = data.with_name(data.name + ".part")
    rows = 0
    with open(part, "wb") as raw:
        hw = HashingWriter(raw)
        with gzip.GzipFile(fileobj=hw, mode="wb", compresslevel=level, mtime=0) as gz:
            cur.execute(f"SELECT {names} FROM dbo.[{table}] {where}", params)
            while True:
                batch = cur.fetchmany(20000)
                if not batch:
                    break
                gz.write("".join(line(r) for r in batch).encode("utf-8"))
                rows += len(batch)
        raw.flush()
        os.fsync(raw.fileno())
    part.replace(data)
    info = {"format": FORMAT, "table": table, "piece": piece, "chunk_column": chunk_col,
            "range": [str(p) for p in params] if params else None, "empty_date": piece == "empty-date",
            "rows": rows, "source_count": count, "count_matches": rows == count, "sums": sums,
            "columns": [c["name"] for c in cols], "bytes": hw.n, "sha256": hw.h.hexdigest(),
            "seconds": round(time.time() - t0, 1), "exported_at": dt.datetime.now().astimezone().isoformat(timespec="seconds")}
    tmp = receipt.with_name(receipt.name + ".part")
    tmp.write_text(json.dumps(info, indent=1))
    tmp.replace(receipt)                                   # written last: a piece with a receipt is complete
    return {"table": table, "piece": piece, "rows": rows, "source_count": count, "bytes": hw.n, "seconds": info["seconds"]}


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", help="settings file with SRC_HOST, SRC_DATABASE, SRC_USER, SRC_PASSWORD")
    ap.add_argument("--out", default="export", help="folder for the files (keep it private: real data)")
    ap.add_argument("--tables", help="comma-separated source tables (default: all in mapping.json)")
    ap.add_argument("--extra", action="append", default=[],
                    help="a table not in mapping.json, as Table or Table:DateColumn (repeat for more)")
    ap.add_argument("--from", dest="date_from", type=dt.date.fromisoformat, help="first day (date-split tables)")
    ap.add_argument("--to", dest="date_to", type=dt.date.fromisoformat, help="last day, default yesterday")
    ap.add_argument("--workers", type=int, default=4, help="pieces exported at the same time (default 4)")
    ap.add_argument("--level", type=int, default=1, help="gzip level 1 (fast) to 9 (small); default 1")
    args = ap.parse_args()
    env = load_env(args.env)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    tables = [(m["source"], m.get("chunk_column")) for m in json.loads((HERE / "mapping.json").read_text())["tables"]]
    if args.tables:
        want = set(args.tables.split(","))
        tables = [t for t in tables if t[0] in want]
    tables += [(e.split(":")[0], e.split(":")[1] if ":" in e else None) for e in args.extra]
    date_to = args.date_to or dt.date.today() - dt.timedelta(days=1)
    explicit = bool(args.date_from)        # a slice from a start date leaves out the rows with no date; --to alone does not

    conn = connect(env)
    catalog_path = out / "_tables.json"
    catalog = json.loads(catalog_path.read_text()) if catalog_path.exists() else {}
    jobs = []
    for table, col in tables:
        cols = describe(conn, table)
        catalog[table] = {"chunk_column": col, "columns": cols}
        pieces = plan(conn, table, col, args.date_from, date_to, explicit)
        jobs += [(table, cols, p, w, prm, col) for p, w, prm in pieces]
        print(f"  {table:32} {len(pieces):>4} piece(s)")
    conn.close()
    catalog_path.write_text(json.dumps(catalog, indent=1))
    # the biggest tables first, so the long ones are not left for the end
    order = {"POS_ORDERDETAILS": 0, "POS_ORDERS": 1, "POS_ORDERPAYMENTS": 2}
    jobs.sort(key=lambda j: order.get(j[0], 9))
    print(f"EXPORT: {len(jobs)} pieces from {len(tables)} tables, up to {date_to}, {args.workers} worker(s) -> {out}")

    t0, rows, bytes_, problems, skipped = time.time(), 0, 0, [], 0
    with ProcessPoolExecutor(args.workers, mp_context=multiprocessing.get_context("spawn")) as pool:
        futures = [pool.submit(export_piece, env, str(out), t, c, p, w, prm, col, args.level) for t, c, p, w, prm, col in jobs]
        for i, f in enumerate(as_completed(futures), 1):
            r = f.result()
            if r.get("skipped"):
                skipped += 1
                continue
            rows += r["rows"]
            bytes_ += r["bytes"]
            flag = "" if r["rows"] == r["source_count"] else f"  !! SQL Server counted {r['source_count']}"
            if flag:
                problems.append(f"{r['table']} {r['piece']}: wrote {r['rows']}, counted {r['source_count']}")
            el = time.time() - t0
            print(f"  [{i}/{len(jobs)}] {r['table']:28} {r['piece']:10} {r['rows']:>10} rows {r['bytes'] / 1e6:>8.1f} MB "
                  f"{r['seconds']:>6.1f}s   total {rows:,} rows, {rows / el:,.0f} rows/s{flag}", flush=True)
    el = time.time() - t0
    print(f"\nDONE in {el:.0f}s: {rows:,} rows, {bytes_ / 1e9:.2f} GB, {skipped} piece(s) already done before")
    if problems:
        print("Counts that changed while exporting (the table was being written to); export these again later:")
        for p in problems:
            print("  " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
