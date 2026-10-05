"""Load the files of export.py into a local Postgres copy of the old tables (schema src), checking every file.

    python3 load_raw.py --env local.env --dir export --workers 4
    python3 load_raw.py --env local.env --dir export --tables POS_ORDERS

The copy keeps the OLD table and column names and close types (varchar -> text, datetime -> timestamp, ...), so it
is the old data as it was; migrate.py then reads it with SRC_DRIVER=postgres and applies all the rules.
Every file is checked: its sha256 must match the receipt (nothing damaged in transfer), and the rows loaded must
equal the rows in the receipt. After a table is loaded, the row count and the amount totals per month are compared
with the numbers SQL Server calculated during the export.

Loaded files are recorded in src._pieces in the same transaction as their rows, so a re-run skips them and a file
is never loaded twice. The copy tables are UNLOGGED (faster to fill; Postgres empties them after a crash, and they
can always be loaded again from the files): use this only for this local copy, never for real tables.
Settings: SRC_HOST, SRC_PORT, SRC_DATABASE, SRC_USER, SRC_PASSWORD (the local Postgres), SRC_SCHEMA (default src).
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal
from pathlib import Path

import psycopg

PG_TYPE = {"bigint": "bigint", "int": "integer", "smallint": "smallint", "tinyint": "smallint", "bit": "boolean",
           "money": "numeric(19,4)", "smallmoney": "numeric(10,4)", "float": "double precision", "real": "real",
           "date": "date", "datetime": "timestamp", "datetime2": "timestamp", "smalldatetime": "timestamp",
           "datetimeoffset": "timestamptz", "time": "time", "uniqueidentifier": "uuid",
           "binary": "bytea", "varbinary": "bytea", "image": "bytea"}
SUM_TYPES = {"decimal", "numeric", "money", "smallmoney", "int", "bigint", "smallint", "tinyint"}


def load_env(path):
    env = dict(os.environ)
    if path:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def connect(env, autocommit=True):
    return psycopg.connect(host=env["SRC_HOST"], port=env.get("SRC_PORT", "5432"), dbname=env["SRC_DATABASE"],
                           user=env["SRC_USER"], password=env["SRC_PASSWORD"], sslmode=env.get("SRC_SSLMODE", "prefer"),
                           autocommit=autocommit)


def pg_type(c):
    t = c["type"]
    if t in ("decimal", "numeric"):
        return f"numeric({c['precision']},{c['scale']})"
    return PG_TYPE.get(t, "text")                  # char, varchar, nvarchar, text ...: text (lengths are checked later)


class HashingReader:
    """Reads a file and keeps the sha256 of the bytes read, so checking it costs no second read."""
    def __init__(self, f):
        self.f, self.h = f, hashlib.sha256()

    def read(self, n=-1):
        b = self.f.read(n)
        self.h.update(b)
        return b

    def readinto(self, buf):
        n = self.f.readinto(buf)
        self.h.update(memoryview(buf)[:n])
        return n

    def readable(self):
        return True


_local = threading.local()


def load_piece(env, schema, folder, table, piece, receipt, force):
    if not hasattr(_local, "conn"):
        _local.conn = connect(env)
    conn = _local.conn
    rec = json.loads(receipt.read_text())
    data = folder / f"{piece}.tsv.gz"
    if not rec.get("count_matches"):
        raise SystemExit(f"{table} {piece}: the receipt says SQL Server counted {rec['source_count']} rows but "
                         f"{rec['rows']} were written; export this piece again")
    with conn.transaction():
        old = conn.execute(f'SELECT sha256 FROM "{schema}"._pieces WHERE table_name = %s AND piece = %s',
                           (table, piece)).fetchone()
        if old and old[0] == rec["sha256"] and not force:
            return {"table": table, "piece": piece, "skipped": True}
        if old:                                            # exported again since: replace that piece's rows
            conn.execute(f'DELETE FROM "{schema}"."{table}" {piece_where(rec)}', piece_params(rec))
            conn.execute(f'DELETE FROM "{schema}"._pieces WHERE table_name = %s AND piece = %s', (table, piece))
        t0 = time.time()
        cols = ", ".join(f'"{c}"' for c in rec["columns"])
        with open(data, "rb") as raw:
            hr = HashingReader(raw)
            with gzip.GzipFile(fileobj=hr, mode="rb") as gz, conn.cursor() as cur:
                with cur.copy(f'COPY "{schema}"."{table}" ({cols}) FROM STDIN') as cp:
                    while True:
                        block = gz.read(1 << 20)
                        if not block:
                            break
                        cp.write(block)
                loaded = cur.rowcount
            hr.read()                                      # anything after the gzip end still counts in the checksum
        if hr.h.hexdigest() != rec["sha256"]:
            raise SystemExit(f"{table} {piece}: the file's checksum does not match its receipt (damaged or changed); "
                             f"get this file again")
        if loaded != rec["rows"]:
            raise SystemExit(f"{table} {piece}: loaded {loaded} rows, the receipt says {rec['rows']}")
        conn.execute(f'INSERT INTO "{schema}"._pieces (table_name, piece, sha256, rows, loaded_at) VALUES (%s, %s, %s, %s, now())',
                     (table, piece, rec["sha256"], loaded))
    return {"table": table, "piece": piece, "rows": loaded, "seconds": round(time.time() - t0, 1)}


def piece_where(rec):
    if rec["range"]:
        return f'WHERE "{rec["chunk_column"]}" >= %s AND "{rec["chunk_column"]}" < %s'
    if rec["empty_date"]:
        return f'WHERE "{rec["chunk_column"]}" IS NULL'
    return ""


def piece_params(rec):
    return tuple(dt.date.fromisoformat(d) for d in rec["range"]) if rec["range"] else ()


def check_table(conn, schema, table, receipts, sum_cols):
    """Rows and amount totals of every piece in the copy, against the numbers SQL Server gave in the receipts."""
    problems = []
    for rec in receipts:
        sums_sql = "".join(f', SUM("{c}")' for c in sum_cols)
        got = conn.execute(f'SELECT count(*){sums_sql} FROM "{schema}"."{table}" {piece_where(rec)}', piece_params(rec)).fetchone()
        if got[0] != rec["source_count"]:
            problems.append(f"{rec['piece']}: {got[0]} rows in the copy, SQL Server counted {rec['source_count']}")
        for c, v in zip(sum_cols, got[1:]):
            want = rec["sums"].get(c)
            if (v is None) != (want is None) or (v is not None and abs(Decimal(v) - Decimal(want)) > Decimal("0.000001")):
                problems.append(f"{rec['piece']}: total of {c} is {v} in the copy, {want} on SQL Server")
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", help="settings file with SRC_* pointing at the LOCAL Postgres")
    ap.add_argument("--dir", default="export", help="folder made by export.py")
    ap.add_argument("--tables", help="comma-separated tables (default: all in the folder)")
    ap.add_argument("--workers", type=int, default=4, help="files loaded at the same time (default 4)")
    ap.add_argument("--force", action="store_true", help="load files again even if already loaded")
    args = ap.parse_args()
    env = load_env(args.env)
    schema = env.get("SRC_SCHEMA", "src")
    base = Path(args.dir)
    catalog = json.loads((base / "_tables.json").read_text())
    tables = [t for t in catalog if not args.tables or t in set(args.tables.split(","))]

    conn = connect(env)
    conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    conn.execute(f'CREATE TABLE IF NOT EXISTS "{schema}"._pieces (table_name text, piece text, sha256 text, rows bigint, '
                 f'loaded_at timestamptz, PRIMARY KEY (table_name, piece))')
    jobs, receipts = [], {}
    for t in tables:
        cols = catalog[t]["columns"]
        conn.execute(f'CREATE UNLOGGED TABLE IF NOT EXISTS "{schema}"."{t}" ('
                     + ", ".join(f'"{c["name"]}" {pg_type(c)}' for c in cols) + ")")
        folder = base / t
        recs = sorted(folder.glob("*.json")) if folder.exists() else []
        receipts[t] = [json.loads(r.read_text()) for r in recs]
        jobs += [(folder, t, r.stem, r) for r in recs]
        missing = [p for p in folder.glob("*.tsv.gz") if not (folder / (p.name[:-7] + ".json")).exists()] if folder.exists() else []
        if missing:
            print(f"  !! {t}: {len(missing)} file(s) without a receipt (export not finished): skipped")
    print(f"LOAD: {len(jobs)} files of {len(tables)} tables -> {env['SRC_DATABASE']}.{schema}, {args.workers} worker(s)")

    t0, rows, skipped = time.time(), 0, 0
    with ThreadPoolExecutor(args.workers) as pool:
        futures = [pool.submit(load_piece, env, schema, f, t, p, r, args.force) for f, t, p, r in jobs]
        for i, f in enumerate(as_completed(futures), 1):
            r = f.result()
            if r.get("skipped"):
                skipped += 1
                continue
            rows += r["rows"]
            print(f"  [{i}/{len(jobs)}] {r['table']:28} {r['piece']:10} {r['rows']:>10} rows {r['seconds']:>6.1f}s   "
                  f"total {rows:,} rows, {rows / (time.time() - t0):,.0f} rows/s", flush=True)

    print("\nCHECK against the receipts (rows and totals per piece), then index the date column for migrate.py")
    bad = False
    for t in tables:
        sum_cols = [c["name"] for c in catalog[t]["columns"] if c["type"] in SUM_TYPES]
        problems = check_table(conn, schema, t, receipts[t], sum_cols)
        col = catalog[t]["chunk_column"]
        if col:
            conn.execute(f'CREATE INDEX IF NOT EXISTS "{t}_{col}_idx" ON "{schema}"."{t}" ("{col}")')
        conn.execute(f'ANALYZE "{schema}"."{t}"')
        n = conn.execute(f'SELECT count(*) FROM "{schema}"."{t}"').fetchone()[0]
        print(f"  {t:32} {n:>12,} rows  {'ok' if not problems else 'PROBLEMS'}")
        for p in problems:
            print("     " + p)
        bad |= bool(problems)
    print(f"\nDONE in {time.time() - t0:.0f}s: {rows:,} rows loaded now, {skipped} file(s) loaded before")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
