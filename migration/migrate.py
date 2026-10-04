"""Copy the old SQL Server tables (dbo) into the new Postgres tables (master), following mapping.json.

How it works, per table (lookup tables first, then the big ones):
  1. Read the target table's columns from Postgres: type, length, decimals, NOT NULL, default, enum values.
  2. Read the source in chunks (one week of chunk_column at a time, then the rows where it is empty).
  3. Fix every row to fit the target column: rename, text flags -> true/false, text -> uuid, enum check, datetime -> date
     or ISO text, rounding to the target decimals, length check, NOT NULL check, fixed values (budget_year).
  4. A row that cannot fit is NOT loaded: it goes to errors/<table>.csv with the reason. Nothing is cut short silently.
  5. Good rows go in with COPY (Postgres bulk load), one transaction per chunk. A finished chunk is saved in the
     checkpoint file, so a re-run continues where it stopped.
  6. At the end: source rows = loaded + rejected, and the totals of key amounts match (old vs new).

Usage:
    python3 migrate.py --env my.env --dry-run          # check everything, write nothing (run this first)
    python3 migrate.py --env my.env                    # load
    python3 migrate.py --env my.env --tables POS_ORDERS --from 2026-09-01 --to 2026-09-30
Settings (env file or environment): see config.example.env. The source is only read, never changed.
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import time
import uuid
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
TRUE = {"true", "t", "yes", "y", "1"}
FALSE = {"false", "f", "no", "n", "0"}
# Amounts whose totals are compared old vs new after the load (source column names).
VERIFY_SUMS = {"POS_ORDERS": ["Net", "Tax"], "POS_ORDERDETAILS": ["ValueAddedBasePrice"], "POS_ORDERPAYMENTS": ["PaymentAmount"],
               "POS_ORDERPAIDOUTS": ["PaymentAmount"], "WeeklyCogs": ["cogs", "waste_value", "inv_adj_value"],
               "EmployeePaySummaryV2": ["Hours"], "Temp_DLH": ["DLH"], "Sales_2026_UnPivot_New": ["value"],
               "GM_2026_UnPivot_New": ["value"], "Transactions_2026_UnPivot_v2": ["value"], "DLH_2026_UnPivot_New": ["value"]}


class Reject(Exception):
    """A value that cannot go into its target column; the row is written to the error file instead.
    kind: the reason without any row values (column + problem), safe to show on the progress dashboard."""
    def __init__(self, msg, kind):
        super().__init__(msg)
        self.kind = kind


# ---------------------------------------------------------------- settings
def load_env(path):
    env = dict(os.environ)
    if path:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def source_conn(env):
    driver = env.get("SRC_DRIVER", "pymssql")
    if driver == "pymssql":
        import pymssql
        return pymssql.connect(server=env["SRC_HOST"], port=int(env.get("SRC_PORT", "1433")), user=env["SRC_USER"],
                               password=env["SRC_PASSWORD"], database=env["SRC_DATABASE"], login_timeout=30), "%s"
    if driver == "pyodbc":
        import pyodbc
        cs = (f"DRIVER={{{env.get('SRC_ODBC_DRIVER', 'ODBC Driver 18 for SQL Server')}}};SERVER={env['SRC_HOST']},{env.get('SRC_PORT', '1433')};"
              f"DATABASE={env['SRC_DATABASE']};UID={env['SRC_USER']};PWD={env['SRC_PASSWORD']};Encrypt=yes;"
              f"TrustServerCertificate={env.get('SRC_TRUST_CERT', 'no')};ApplicationIntent=ReadOnly")
        return pyodbc.connect(cs, readonly=True), "?"
    sys.exit(f"SRC_DRIVER must be pymssql or pyodbc, not {driver}")


def target_conn(env):
    # autocommit: every "with tc.transaction()" below is then a real transaction that is saved (or rolled back) on its
    # own. Without it, psycopg keeps one long transaction open and the chunks are only savepoints inside it.
    return psycopg.connect(host=env["TGT_HOST"], port=env.get("TGT_PORT", "5432"), dbname=env["TGT_DATABASE"],
                           user=env["TGT_USER"], password=env["TGT_PASSWORD"], sslmode=env.get("TGT_SSLMODE", "prefer"),
                           autocommit=True)


# ---------------------------------------------------------------- target description
def describe_target(tc, schema, table):
    cols = {}
    rows = tc.execute("""SELECT column_name, data_type, udt_schema, udt_name, character_maximum_length, numeric_precision,
                                numeric_scale, is_nullable = 'YES', column_default
                         FROM information_schema.columns WHERE table_schema = %s AND table_name = %s""", (schema, table)).fetchall()
    if not rows:
        raise SystemExit(f"target table {schema}.{table} not found")
    for name, typ, us, un, length, prec, scale, nullable, default in rows:
        info = {"type": typ, "length": length, "precision": prec, "scale": scale, "nullable": nullable, "default": default}
        if typ == "USER-DEFINED":
            info["enum"] = {r[0] for r in tc.execute(
                "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace "
                "WHERE n.nspname = %s AND t.typname = %s", (us, un))}
        cols[name] = info
    pk = [r[0] for r in tc.execute(
        """SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = %s::regclass AND i.indisprimary""", (f"{schema}.{table}",))]
    return cols, pk


# ---------------------------------------------------------------- value conversion
def iso_text(v):
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%d") if v.time() == dt.time() else v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, dt.date):
        return v.strftime("%Y-%m-%d")
    return str(v)


def convert(v, col, info, warn):
    """Return the value ready for the target column, or raise Reject with the reason."""
    if isinstance(v, str) and info["type"] not in ("character varying", "text", "character"):
        v = v.strip()
        if v == "":
            v = None
    if v is None:
        if info["nullable"]:
            return None
        d = (info["default"] or "").lower()
        if "now()" in d or "current_timestamp" in d:
            return dt.datetime.now()
        raise Reject(f"{col}: empty, but the target column does not allow empty values", f"{col}: empty, not allowed")
    t = info["type"]
    try:
        if t in ("character varying", "text", "character"):
            s = iso_text(v) if isinstance(v, (dt.date, dt.datetime)) else str(v)
            if info["length"] and len(s) > info["length"]:
                raise Reject(f"{col}: {len(s)} characters, the target allows {info['length']}", f"{col}: text too long")
            return s
        if t in ("integer", "bigint", "smallint"):
            n = int(v)
            lim = {"smallint": 2 ** 15, "integer": 2 ** 31, "bigint": 2 ** 63}[t]
            if not -lim <= n < lim:
                raise Reject(f"{col}: {n} is too big for {t}", f"{col}: number too big")
            return n
        if t == "numeric":
            d = Decimal(str(v))
            if info["scale"] is not None:
                d = d.quantize(Decimal(1).scaleb(-info["scale"]), rounding=ROUND_HALF_UP)
            if info["precision"] is not None and abs(d) >= Decimal(10) ** (info["precision"] - (info["scale"] or 0)):
                raise Reject(f"{col}: {d} is too big for numeric({info['precision']},{info['scale']})", f"{col}: number too big")
            return d
        if t in ("double precision", "real"):
            return float(v)
        if t == "boolean":
            if isinstance(v, bool):
                return v
            s = str(v).strip().lower()
            if s in TRUE:
                return True
            if s in FALSE:
                return False
            raise Reject(f"{col}: '{v}' is not a yes/no value", f"{col}: not a yes/no value")
        if t == "uuid":
            return uuid.UUID(str(v).strip())
        if t == "date":
            if isinstance(v, dt.datetime):
                if v.time() != dt.time():
                    warn(f"{col}: time of day {v.time()} dropped")
                return v.date()
            if isinstance(v, dt.date):
                return v
            return dt.date.fromisoformat(str(v)[:10])
        if t.startswith("timestamp"):
            if isinstance(v, dt.datetime):
                return v
            if isinstance(v, dt.date):
                return dt.datetime.combine(v, dt.time())
            return dt.datetime.fromisoformat(str(v))
        if t == "USER-DEFINED":
            s = str(v)
            if s not in info["enum"]:
                raise Reject(f"{col}: '{s}' is not one of the allowed values {sorted(info['enum'])}", f"{col}: not an allowed value")
            return s
    except Reject:
        raise
    except (ValueError, InvalidOperation, TypeError) as e:
        raise Reject(f"{col}: '{v}' does not fit {t} ({e})", f"{col}: wrong type")
    return v


# ---------------------------------------------------------------- chunks
def chunks(sc, ph, table, col, date_from, date_to, plan=None):
    """(label, where-clause, params) per week of col, then the rows where col is empty; one chunk without col."""
    plan = {} if plan is None else plan
    if not col:
        plan["total"] = 1
        yield "all", "", ()
        return
    cur = sc.cursor()
    cur.execute(f"SELECT MIN([{col}]), MAX([{col}]) FROM dbo.[{table}]")
    lo, hi = cur.fetchone()
    if lo is not None:
        lo = lo.date() if isinstance(lo, dt.datetime) else lo
        hi = hi.date() if isinstance(hi, dt.datetime) else hi
        if date_from:
            lo = max(lo, date_from)
        if date_to:
            hi = min(hi, date_to)
        plan["total"] = max(0, -(-((hi - lo).days + 1) // 7)) + (0 if date_from or date_to else 1)
        start = lo
        while start <= hi:
            end = min(start + dt.timedelta(days=7), hi + dt.timedelta(days=1))
            yield f"{start}..{end - dt.timedelta(days=1)}", f"WHERE [{col}] >= {ph} AND [{col}] < {ph}", (start, end)
            start = end
    if lo is None:
        plan["total"] = 0 if date_from or date_to else 1
    if not date_from and not date_to:
        yield "empty-" + col, f"WHERE [{col}] IS NULL", ()


# ---------------------------------------------------------------- one table
def migrate_table(m, sc, ph, tc, schema, args, state, out, env, progress):
    src, tgt = m["source"], m["target"]
    tcols, pk = describe_target(tc, schema, tgt)
    mapped = [(s, t) for s, t in m["columns"].items() if t in tcols]
    fixed = m.get("fixed", {})
    tgt_cols = [t for _, t in mapped] + [k for k in fixed if k not in dict(mapped).values()]
    src_cols = [s for s, _ in mapped]
    keep_pk = [c for c in pk if c in tgt_cols and not (tcols[c]["default"] or "")]  # keys we load ourselves: check duplicates
    seen = set()
    done = state.setdefault(tgt, {})
    if not done and not args.dry_run:
        n = tc.execute(f'SELECT count(*) FROM {schema}."{tgt}"').fetchone()[0]
        if n:
            raise SystemExit(f"{schema}.{tgt} already has {n} rows and no checkpoint: refusing to load twice "
                             f"(empty it first, or delete the checkpoint only if you know it is safe)")
    stats = {"read": 0, "loaded": 0, "rejected": 0, "warnings": 0, "chunks": 0, "skipped_chunks": 0,
             "src_sums": {c: Decimal(0) for c in VERIFY_SUMS.get(src, []) if c in src_cols}}
    live = progress.table(src)
    live.update(status="running", rejected_by_reason={})
    err_path = out / "errors" / f"{tgt}.csv"
    err_path.parent.mkdir(parents=True, exist_ok=True)
    with open(err_path, "a", newline="") as ef:
        ew = csv.writer(ef)
        if ef.tell() == 0:
            ew.writerow(["source_table", "chunk", "reason", "source_row"])
        plan = {}
        for label, where, params in chunks(sc, ph, src, m.get("chunk_column"), args.date_from, args.date_to, plan):
            live["chunks_total"] = plan.get("total")
            if isinstance(done.get(label), dict):          # finished in an earlier run
                stats["skipped_chunks"] += 1
                live["chunks_skipped"] = stats["skipped_chunks"]
                continue
            live["current_chunk"] = label
            progress.save()
            cur = sc.cursor()
            cur.execute(f"SELECT {', '.join(f'[{c}]' for c in src_cols)} FROM dbo.[{src}] {where}", params)
            good, chunk_sums = [], {c: Decimal(0) for c in stats["src_sums"]}
            warnings = []
            while True:
                batch = cur.fetchmany(args.batch)
                if not batch:
                    break
                for raw in batch:
                    stats["read"] += 1
                    row = dict(zip(src_cols, raw))
                    try:
                        vals = [convert(row[s], t, tcols[t], warnings.append) for s, t in mapped]
                        vals += [convert(v, k, tcols[k], warnings.append) for k, v in fixed.items() if k in tgt_cols[len(mapped):]]
                        if keep_pk:
                            key = tuple(vals[tgt_cols.index(c)] for c in keep_pk)
                            if key in seen:
                                raise Reject(f"{'/'.join(keep_pk)} {key}: duplicate key (already loaded)", f"{'/'.join(keep_pk)}: duplicate key")
                            seen.add(key)
                        good.append(vals)
                        for c in chunk_sums:
                            if row[c] is not None:
                                chunk_sums[c] += Decimal(str(row[c]))
                    except Reject as e:
                        stats["rejected"] += 1
                        ew.writerow([src, label, str(e), json.dumps(row, default=str)])
                        live["rejected_by_reason"][e.kind] = live["rejected_by_reason"].get(e.kind, 0) + 1
            stats["warnings"] += len(warnings)
            if warnings:
                (out / "warnings.log").open("a").write("".join(f"{src} {label}: {w}\n" for w in warnings))
            with tc.transaction() as tx:
                with tc.cursor().copy(f'COPY {schema}."{tgt}" ({", ".join(chr(34) + c + chr(34) for c in tgt_cols)}) FROM STDIN') as cp:
                    for vals in good:
                        cp.write_row(vals)
                if args.dry_run:
                    raise psycopg.Rollback(tx)
            stats["loaded"] += len(good)
            stats["chunks"] += 1
            for c in chunk_sums:
                stats["src_sums"][c] += chunk_sums[c]
            if not args.dry_run:
                # saved only after the chunk's transaction committed; its loaded count and amounts make the final check
                # cover the whole table, also when a later run resumes
                done[label] = {"loaded": len(good), "sums": {c: str(v) for c, v in chunk_sums.items()}}
                save_state(out, state)
            print(f"    {src:30} {label:24} loaded {len(good):>7}  rejected so far {stats['rejected']}", flush=True)
            live.update({k: stats[k] for k in ("read", "loaded", "rejected", "warnings")},
                        chunks_done=stats["chunks"], last_chunk=label, current_chunk=None)
            progress.save()
    # an identity copied from the source: move the target's sequence past it
    for c, info in tcols.items():
        d = info["default"] or ""
        if c in tgt_cols and d.startswith("nextval(") and not args.dry_run:
            seq = re.search(r"nextval\('([^']+)'", d).group(1)
            tc.execute(f"SELECT setval(%s, GREATEST((SELECT max(\"{c}\") FROM {schema}.\"{tgt}\"), 1))", (seq,))
    # check: rows and totals
    tgt_map = dict(mapped)
    if not args.dry_run:
        all_done = [v for v in done.values() if isinstance(v, dict)]
        stats["loaded_all_runs"] = sum(v["loaded"] for v in all_done)
        stats["src_sums"] = {c: sum((Decimal(v["sums"].get(c, "0")) for v in all_done), Decimal(0)) for c in stats["src_sums"]}
        with target_conn(env) as fresh:  # a new connection sees only what was really saved
            stats["target_rows"] = fresh.execute(f'SELECT count(*) FROM {schema}."{tgt}"').fetchone()[0]
            stats["tgt_sums"] = {c: fresh.execute(f'SELECT coalesce(sum("{tgt_map[c]}"), 0) FROM {schema}."{tgt}"').fetchone()[0]
                                 for c in stats["src_sums"]}
    return stats


def save_state(out, state):
    (out / "checkpoint.json").write_text(json.dumps(state, indent=1))


class Progress:
    """run/progress.json, rewritten after every chunk, for the online progress dashboard (upload it there).
    Holds only table names, counts, totals and reasons without row values: no rows, hosts, names or passwords."""
    def __init__(self, out, mapping, dry_run, args):
        self.path = out / "progress.json"
        now = dt.datetime.now().astimezone().isoformat(timespec="seconds")
        self.data = {"format": "bi-migration-progress/1", "run_id": now, "mode": "dry-run" if dry_run else "load",
                     "date_from": str(args.date_from or ""), "date_to": str(args.date_to or ""),
                     "started_at": now, "updated_at": now, "finished": False, "result": None,
                     "tables": [{"source": m["source"], "target": m["target"], "status": "waiting"} for m in mapping]}

    def table(self, src):
        return next(t for t in self.data["tables"] if t["source"] == src)

    def save(self, **top):
        self.data.update(top, updated_at=dt.datetime.now().astimezone().isoformat(timespec="seconds"))
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=1, default=str))
        tmp.replace(self.path)      # swap in whole, so an upload mid-run never reads half a file


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", help="settings file (see config.example.env)")
    ap.add_argument("--dry-run", action="store_true", help="read and check everything, write nothing")
    ap.add_argument("--tables", help="comma-separated source tables (default: all, in mapping.json order)")
    ap.add_argument("--from", dest="date_from", type=dt.date.fromisoformat, help="first day to copy (chunked tables)")
    ap.add_argument("--to", dest="date_to", type=dt.date.fromisoformat, help="last day to copy (chunked tables)")
    ap.add_argument("--batch", type=int, default=5000, help="rows fetched at a time")
    ap.add_argument("--out", default="run", help="folder for errors, warnings, checkpoint and summary")
    args = ap.parse_args()
    env = load_env(args.env)
    mapping = json.loads((HERE / "mapping.json").read_text())["tables"]
    if args.tables:
        want = set(args.tables.split(","))
        mapping = [m for m in mapping if m["source"] in want]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cp = out / "checkpoint.json"
    state = json.loads(cp.read_text()) if cp.exists() and not args.dry_run else {}
    schema = env.get("TGT_SCHEMA", "master")
    sc, ph = source_conn(env)
    tc = target_conn(env)
    print(f"{'DRY RUN - nothing is written' if args.dry_run else 'LOADING'}: {len(mapping)} tables -> {env['TGT_DATABASE']}.{schema}")
    summary, ok = {}, True
    progress = Progress(out, mapping, args.dry_run, args)
    progress.save()
    for m in mapping:
        t0 = time.time()
        print(f"  {m['source']} -> {m['target']}")
        try:
            s = migrate_table(m, sc, ph, tc, schema, args, state, out, env, progress)
        except BaseException as e:
            progress.table(m["source"])["status"] = "failed"
            progress.table(m["source"])["error"] = type(e).__name__   # the type only: messages can hold values
            progress.save(finished=True, result="stopped")
            raise
        s["seconds"] = round(time.time() - t0, 1)
        balanced = s["read"] == s["loaded"] + s["rejected"]
        if "target_rows" in s and s["target_rows"] != s["loaded_all_runs"]:
            balanced = False
            print(f"  !! {m['target']}: {s['loaded_all_runs']} rows loaded in all runs, but the target holds {s['target_rows']}")
        s["check_rows"] = "ok" if balanced else "MISMATCH"
        if "tgt_sums" in s:
            s["check_sums"] = {c: {"source": str(v), "target": str(s["tgt_sums"][c]),
                                   "diff": str(Decimal(str(s["tgt_sums"][c])) - v)} for c, v in s["src_sums"].items()}
        ok &= balanced
        s.pop("src_sums"); s.pop("tgt_sums", None)
        summary[m["source"]] = s
        progress.table(m["source"]).update(
            {k: s[k] for k in ("read", "loaded", "rejected", "warnings", "seconds", "check_rows")},
            status="done", current_chunk=None, chunks_done=s["chunks"], target_rows=s.get("target_rows"),
            loaded_all_runs=s.get("loaded_all_runs"), check_sums=s.get("check_sums", {}))
        progress.save()
    (out / "summary.json").write_text(json.dumps(summary, indent=1, default=str))
    sums_ok = all(abs(Decimal(d["diff"])) < Decimal("0.005") for s in summary.values() for d in s.get("check_sums", {}).values())
    progress.save(finished=True, result="ok" if ok and sums_ok else "problems")
    print("\nSUMMARY (source -> read / loaded / rejected / warnings)")
    for src, s in summary.items():
        print(f"  {src:30} {s['read']:>9} {s['loaded']:>9} {s['rejected']:>7} {s['warnings']:>5}  in target {s.get('target_rows', '-'):>7}  rows {s['check_rows']}"
              + "".join(f"  {c} diff {d['diff']}" for c, d in s.get("check_sums", {}).items()))
    print(f"\nRejected rows: {out}/errors/<table>.csv   Warnings: {out}/warnings.log   Summary: {out}/summary.json")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
