"""Copy the old SQL Server tables (dbo) into the new Postgres tables (master), following mapping.json.

The old data is read either straight from SQL Server, or from a Postgres copy of it made by load_raw.py from the
files of export.py (SRC_DRIVER=postgres). The rules and checks are the same either way.

How it works, per table (lookup tables first, then the big ones):
  1. Read the target table's columns from Postgres: type, length, decimals, NOT NULL, default, enum values.
  2. Plan the chunks: one week of chunk_column at a time, then the rows where it is empty (small tables: one chunk).
  3. Fix every row to fit the target column: rename, text flags -> true/false, text -> uuid, enum check, datetime -> date
     or ISO text, rounding to the target decimals, length check, NOT NULL check, fixed values (budget_year).
  4. A row that cannot fit is NOT loaded: it goes to errors/<table>.<chunk>.csv with the reason. Nothing is cut short.
  5. Good rows are streamed into Postgres with COPY while they are read, one transaction per chunk, so memory stays
     small whatever the chunk size. With --workers N, N chunks of a big table load at the same time.
     A finished chunk is saved in the checkpoint file, so a re-run continues where it stopped.
  6. At the end: source rows = loaded + rejected, and the totals of key amounts match (old vs new).

Usage:
    python3 migrate.py --env my.env --dry-run          # check everything, write nothing (run this first)
    python3 migrate.py --env my.env                    # load
    python3 migrate.py --env my.env --workers 6        # load, 6 chunks at a time
    python3 migrate.py --env my.env --tables POS_ORDERS --from 2026-09-01 --to 2026-09-30
Settings (env file or environment): see config.example.env. The source is only read, never changed.
"""
import argparse
import collections
import csv
import datetime as dt
import itertools
import json
import multiprocessing
import os
import re
import sys
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, wait
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
TRUE = {"true", "t", "yes", "y", "1"}
FALSE = {"false", "f", "no", "n", "0"}
TEXT_TYPES = ("character varying", "text", "character")
# Amounts whose totals are compared old vs new after the load (source column names).
VERIFY_SUMS = {"POS_ORDERS": ["Net", "Tax"], "POS_ORDERDETAILS": ["ValueAddedBasePrice"], "POS_ORDERPAYMENTS": ["PaymentAmount"],
               "POS_ORDERPAIDOUTS": ["PaymentAmount"], "WeeklyCogs": ["cogs", "waste_value", "inv_adj_value"],
               "EmployeePaySummaryV2": ["Hours"], "Temp_DLH": ["DLH"], "Sales_2026_UnPivot_New": ["value"],
               "GM_2026_UnPivot_New": ["value"], "Transactions_2026_UnPivot_v2": ["value"], "DLH_2026_UnPivot_New": ["value"]}
RETRIES = 2          # a chunk that fails on a connection error is tried again this many times (it was rolled back)


class Reject(Exception):
    """A value that cannot go into its target column; the row is written to the error file instead.
    kind: the reason without any row values (column + problem), safe to show on the progress dashboard."""
    def __init__(self, msg, kind):
        super().__init__(msg)
        self.kind = kind


def load_env(path):
    env = dict(os.environ)
    if path:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


# ---------------------------------------------------------------- connections
class Source:
    """The old data, read only: SQL Server (pymssql or pyodbc), or the Postgres copy made by load_raw.py (postgres)."""
    _names = itertools.count()

    def __init__(self, env):
        self.driver = env.get("SRC_DRIVER", "pymssql")
        self.pg = self.driver == "postgres"
        if self.driver == "pymssql":
            import pymssql
            self.conn = pymssql.connect(server=env["SRC_HOST"], port=int(env.get("SRC_PORT", "1433")), user=env["SRC_USER"],
                                        password=env["SRC_PASSWORD"], database=env["SRC_DATABASE"], login_timeout=30)
        elif self.driver == "pyodbc":
            import pyodbc
            cs = (f"DRIVER={{{env.get('SRC_ODBC_DRIVER', 'ODBC Driver 18 for SQL Server')}}};SERVER={env['SRC_HOST']},{env.get('SRC_PORT', '1433')};"
                  f"DATABASE={env['SRC_DATABASE']};UID={env['SRC_USER']};PWD={env['SRC_PASSWORD']};Encrypt=yes;"
                  f"TrustServerCertificate={env.get('SRC_TRUST_CERT', 'no')};ApplicationIntent=ReadOnly")
            self.conn = pyodbc.connect(cs, readonly=True)
        elif self.pg:
            self.schema = env.get("SRC_SCHEMA", "src")
            self.conn = psycopg.connect(host=env["SRC_HOST"], port=env.get("SRC_PORT", "5432"), dbname=env["SRC_DATABASE"],
                                        user=env["SRC_USER"], password=env["SRC_PASSWORD"],
                                        sslmode=env.get("SRC_SSLMODE", "prefer"))
            self.conn.read_only = True
        else:
            sys.exit(f"SRC_DRIVER must be pymssql, pyodbc or postgres, not {self.driver}")
        self.ph = "?" if self.driver == "pyodbc" else "%s"

    def q(self, name):
        return f'"{name}"' if self.pg else f"[{name}]"

    def table(self, name):
        return f'"{self.schema}"."{name}"' if self.pg else f"dbo.[{name}]"

    def stream(self, sql, params):
        """Rows of a query, fetched a batch at a time (a server-side cursor on Postgres, so nothing is held whole)."""
        cur = self.conn.cursor(name=f"c{next(self._names)}") if self.pg else self.conn.cursor()
        cur.execute(sql, params)
        return cur

    def end(self):
        if self.pg:
            self.conn.rollback()        # ends the read transaction the server-side cursor needed


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
            info["enum"] = sorted(r[0] for r in tc.execute(
                "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace "
                "WHERE n.nspname = %s AND t.typname = %s", (us, un)))
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


def make_converter(col, info, warn):
    """A function that turns one source value into the value for target column col, or raises Reject.
    The column's rules are worked out once here, so each value only runs the few lines its column needs."""
    t, nullable = info["type"], info["nullable"]
    d = (info["default"] or "").lower()
    now_default = "now()" in d or "current_timestamp" in d

    def empty():
        if nullable:
            return None
        if now_default:
            return dt.datetime.now()
        raise Reject(f"{col}: empty, but the target column does not allow empty values", f"{col}: empty, not allowed")

    if t in TEXT_TYPES:
        length = info["length"]

        def text(v):
            if v is None:
                return empty()
            s = v if type(v) is str else iso_text(v) if isinstance(v, (dt.date, dt.datetime)) else str(v)
            if length and len(s) > length:
                raise Reject(f"{col}: {len(s)} characters, the target allows {length}", f"{col}: text too long")
            return s
        return text

    if t in ("integer", "bigint", "smallint"):
        lim = {"smallint": 2 ** 15, "integer": 2 ** 31, "bigint": 2 ** 63}[t]

        def core(v):
            n = int(v)
            if not -lim <= n < lim:
                raise Reject(f"{col}: {n} is too big for {t}", f"{col}: number too big")
            return n
    elif t == "numeric":
        step = Decimal(1).scaleb(-info["scale"]) if info["scale"] is not None else None
        top = Decimal(10) ** (info["precision"] - (info["scale"] or 0)) if info["precision"] is not None else None

        def core(v):
            n = v if type(v) is Decimal else Decimal(str(v))
            if step is not None:
                n = n.quantize(step, rounding=ROUND_HALF_UP)
            if top is not None and abs(n) >= top:
                raise Reject(f"{col}: {n} is too big for numeric({info['precision']},{info['scale']})", f"{col}: number too big")
            return n
    elif t in ("double precision", "real"):
        core = float
    elif t == "boolean":
        def core(v):
            if isinstance(v, bool):
                return v
            s = str(v).strip().lower()
            if s in TRUE:
                return True
            if s in FALSE:
                return False
            raise Reject(f"{col}: '{v}' is not a yes/no value", f"{col}: not a yes/no value")
    elif t == "uuid":
        def core(v):
            return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v).strip())
    elif t == "date":
        def core(v):
            if isinstance(v, dt.datetime):
                if v.time() != dt.time():
                    warn(f"{col}: time of day {v.time()} dropped")
                return v.date()
            if isinstance(v, dt.date):
                return v
            return dt.date.fromisoformat(str(v)[:10])
    elif t.startswith("timestamp"):
        def core(v):
            if isinstance(v, dt.datetime):
                return v
            if isinstance(v, dt.date):
                return dt.datetime.combine(v, dt.time())
            return dt.datetime.fromisoformat(str(v))
    elif t == "USER-DEFINED":
        allowed = set(info["enum"])

        def core(v):
            s = str(v)
            if s not in allowed:
                raise Reject(f"{col}: '{s}' is not one of the allowed values {sorted(allowed)}", f"{col}: not an allowed value")
            return s
    else:
        def core(v):
            return v

    def conv(v):
        if type(v) is str:
            v = v.strip()
            if v == "":
                v = None
        if v is None:
            return empty()
        try:
            return core(v)
        except Reject:
            raise
        except (ValueError, InvalidOperation, TypeError) as e:
            raise Reject(f"{col}: '{v}' does not fit {t} ({e})", f"{col}: wrong type")
    return conv


def convert(v, col, info, warn):
    """One value at a time (kept for checks and small uses); the load uses make_converter."""
    return make_converter(col, info, warn)(v)


# ---------------------------------------------------------------- chunks
def chunks(src, table, col, date_from, date_to):
    """[(label, where-clause, params)]: one per week of col, then the rows where col is empty; one chunk without col."""
    if not col:
        return [("all", "", ())]
    cur = src.conn.cursor()
    cur.execute(f"SELECT MIN({src.q(col)}), MAX({src.q(col)}) FROM {src.table(table)}")
    lo, hi = cur.fetchone()
    src.end()
    plan = []
    if lo is not None:
        lo = lo.date() if isinstance(lo, dt.datetime) else lo
        hi = hi.date() if isinstance(hi, dt.datetime) else hi
        if date_from:
            lo = max(lo, date_from)
        if date_to:
            hi = min(hi, date_to)
        start = lo
        while start <= hi:
            end = min(start + dt.timedelta(days=7), hi + dt.timedelta(days=1))
            plan.append((f"{start}..{end - dt.timedelta(days=1)}",
                         f"WHERE {src.q(col)} >= {src.ph} AND {src.q(col)} < {src.ph}", (start, end)))
            start = end
    if not date_from and not date_to:
        plan.append(("empty-" + col, f"WHERE {src.q(col)} IS NULL", ()))
    return plan


# ---------------------------------------------------------------- one chunk (main process or a worker process)
_CONN = {}


def _conns(env):
    """One source and one target connection per process, opened on first use and kept."""
    if "src" not in _CONN:
        _CONN["src"], _CONN["tgt"] = Source(env), target_conn(env)
    return _CONN["src"], _CONN["tgt"]


def _drop_conns():
    for c in _CONN.values():
        try:
            (c.conn if isinstance(c, Source) else c).close()
        except Exception:
            pass
    _CONN.clear()


def load_chunk(job, label, where, params, seen=None):
    """Read one chunk from the source, fix every row and stream the good ones into the target with COPY, all in one
    transaction (rolled back on a dry run). Returns the chunk's counts; rejected rows go to the chunk's error file."""
    for attempt in range(RETRIES + 1):
        try:
            return _load_chunk(job, label, where, params, seen)
        except (psycopg.OperationalError, OSError) as e:      # connection lost: the transaction was rolled back
            _drop_conns()
            if attempt == RETRIES or seen is not None:       # with a duplicate check, a retry would see half the keys
                raise
            print(f"    {job['src']} {label}: {type(e).__name__}, trying again ({attempt + 1}/{RETRIES})", flush=True)
            time.sleep(5 * (attempt + 1))


def _load_chunk(job, label, where, params, seen):
    src, tc = _conns(job["env"])
    tcols, mapped, schema, tgt = job["tcols"], job["mapped"], job["schema"], job["tgt"]
    warnings = []
    convs = [make_converter(t, tcols[t], warnings.append) for _, t in mapped]
    fixed_vals, fixed_err = [], None
    try:
        fixed_vals = [convert(v, k, tcols[k], warnings.append) for k, v in job["fixed"]]
    except Reject as e:
        fixed_err = e
    src_cols, tgt_cols, keep_pk = job["src_cols"], job["tgt_cols"], job["keep_pk"]
    key_idx = [tgt_cols.index(c) for c in keep_pk]
    sum_idx = [(c, src_cols.index(c)) for c in job["sum_cols"]]
    sums = {c: Decimal(0) for c, _ in sum_idx}
    n = {"read": 0, "loaded": 0, "rejected": 0}
    reasons = collections.Counter()
    safe = re.sub(r"[^0-9A-Za-z.-]+", "_", label)
    err_path = Path(job["out"]) / "errors" / f"{tgt}.{safe}.csv"
    err_file = err_writer = None
    if err_path.exists():
        err_path.unlink()                                    # a re-run of this chunk replaces its error file
    cur = src.stream(f"SELECT {', '.join(src.q(c) for c in src_cols)} FROM {src.table(job['src'])} {where}", params)
    cols_sql = ", ".join('"' + c + '"' for c in tgt_cols)
    try:
        with tc.transaction() as tx:
            with tc.cursor().copy(f'COPY {schema}."{tgt}" ({cols_sql}) FROM STDIN') as cp:
                while True:
                    batch = cur.fetchmany(job["batch"])
                    if not batch:
                        break
                    for raw in batch:
                        n["read"] += 1
                        try:
                            if fixed_err:
                                raise fixed_err
                            vals = [c(v) for c, v in zip(convs, raw)]
                            if fixed_vals:
                                vals += fixed_vals
                            if seen is not None:
                                key = tuple(vals[i] for i in key_idx)
                                if key in seen:
                                    raise Reject(f"{'/'.join(keep_pk)} {key}: duplicate key (already loaded)",
                                                 f"{'/'.join(keep_pk)}: duplicate key")
                                seen.add(key)
                            cp.write_row(vals)
                            n["loaded"] += 1
                            for c, i in sum_idx:
                                x = raw[i]
                                if x is not None:
                                    sums[c] += x if type(x) is Decimal else Decimal(str(x))
                        except Reject as e:
                            n["rejected"] += 1
                            reasons[e.kind] += 1
                            if err_writer is None:
                                err_path.parent.mkdir(parents=True, exist_ok=True)
                                err_file = open(err_path, "w", newline="")
                                err_writer = csv.writer(err_file)
                                err_writer.writerow(["source_table", "chunk", "reason", "source_row"])
                            err_writer.writerow([job["src"], label, str(e), json.dumps(dict(zip(src_cols, raw)), default=str)])
            if job["dry_run"]:
                raise psycopg.Rollback(tx)
    finally:
        if err_file:
            err_file.close()
        try:
            cur.close()
        except Exception:
            pass
        src.end()
    if warnings:
        wpath = Path(job["out"]) / "warnings" / f"{tgt}.{safe}.log"
        wpath.parent.mkdir(parents=True, exist_ok=True)
        wpath.write_text("".join(f"{job['src']} {label}: {w}\n" for w in warnings))
    return {"label": label, **n, "warnings": len(warnings), "sums": {c: str(v) for c, v in sums.items()},
            "reasons": dict(reasons)}


# ---------------------------------------------------------------- one table
def migrate_table(m, src, tc, schema, args, state, out, env, progress, pool):
    s_name, tgt = m["source"], m["target"]
    tcols, pk = describe_target(tc, schema, tgt)
    mapped = [(s, t) for s, t in m["columns"].items() if t in tcols]
    fixed = [(k, v) for k, v in m.get("fixed", {}).items() if k in tcols and k not in dict(mapped).values()]
    tgt_cols = [t for _, t in mapped] + [k for k, _ in fixed]
    src_cols = [s for s, _ in mapped]
    keep_pk = [c for c in pk if c in tgt_cols and not (tcols[c]["default"] or "")]  # keys we load ourselves: check duplicates
    done = state.setdefault(tgt, {})
    if not done and not args.dry_run:
        n = tc.execute(f'SELECT count(*) FROM {schema}."{tgt}"').fetchone()[0]
        if n:
            raise SystemExit(f"{schema}.{tgt} already has {n} rows and no checkpoint: refusing to load twice "
                             f"(empty it first, or delete the checkpoint only if you know it is safe)")
    job = {"env": env, "src": s_name, "tgt": tgt, "schema": schema, "tcols": tcols, "mapped": mapped, "fixed": fixed,
           "src_cols": src_cols, "tgt_cols": tgt_cols, "keep_pk": keep_pk, "batch": args.batch, "dry_run": args.dry_run,
           "out": str(out), "sum_cols": [c for c in VERIFY_SUMS.get(s_name, []) if c in src_cols]}
    stats = {"read": 0, "loaded": 0, "rejected": 0, "warnings": 0, "chunks": 0, "skipped_chunks": 0,
             "src_sums": {c: Decimal(0) for c in job["sum_cols"]}}
    live = progress.table(s_name)
    live.update(status="running", rejected_by_reason={})
    plan = chunks(src, s_name, m.get("chunk_column"), args.date_from, args.date_to)
    live["chunks_total"] = len(plan)
    todo = []
    for label, where, params in plan:
        if isinstance(done.get(label), dict):           # finished in an earlier run
            stats["skipped_chunks"] += 1
        else:
            todo.append((label, where, params))
    live["chunks_skipped"] = stats["skipped_chunks"]
    progress.save()

    def finished(r):
        for k in ("read", "loaded", "rejected", "warnings"):
            stats[k] += r[k]
        stats["chunks"] += 1
        for c, v in r["sums"].items():
            stats["src_sums"][c] += Decimal(v)
        for k, v in r["reasons"].items():
            live["rejected_by_reason"][k] = live["rejected_by_reason"].get(k, 0) + v
        if not args.dry_run:
            # saved only after the chunk's transaction committed; its loaded count and amounts make the final check
            # cover the whole table, also when a later run resumes
            done[r["label"]] = {"loaded": r["loaded"], "sums": r["sums"]}
            save_state(out, state)
        print(f"    {s_name:30} {r['label']:24} loaded {r['loaded']:>8}  rejected so far {stats['rejected']}", flush=True)
        live.update({k: stats[k] for k in ("read", "loaded", "rejected", "warnings")},
                    chunks_done=stats["chunks"], last_chunk=r["label"])

    # Parallel only when there is no duplicate check of our own (it must see every key of the table in one place).
    if pool and len(todo) > 1 and not keep_pk:
        running = {pool.submit(load_chunk, job, *c): c[0] for c in todo}
        live["current_chunk"] = f"{min(len(running), args.workers)} chunks at a time"
        progress.save()
        try:
            while running:
                ready, _ = wait(running, return_when=FIRST_COMPLETED)
                for f in ready:
                    running.pop(f)
                    finished(f.result())
                live["current_chunk"] = f"{min(len(running), args.workers)} chunks at a time" if running else None
                progress.save()
        except BaseException:
            for f in running:
                f.cancel()
            raise
    else:
        seen = set() if keep_pk else None
        for c in todo:
            live["current_chunk"] = c[0]
            progress.save()
            finished(load_chunk(job, *c, seen=seen))
            live["current_chunk"] = None
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
    tmp = out / "checkpoint.json.tmp"
    tmp.write_text(json.dumps(state, indent=1))
    tmp.replace(out / "checkpoint.json")     # swap in whole: a stop mid-write never leaves half a checkpoint


class Progress:
    """run/progress.json, rewritten after every chunk, for the online progress dashboard (upload it there).
    Holds only table names, counts, totals and reasons without row values: no rows, hosts, names or passwords."""
    def __init__(self, out, mapping, dry_run, args):
        self.path = out / "progress.json"
        now = dt.datetime.now().astimezone().isoformat(timespec="seconds")
        self.data = {"format": "bi-migration-progress/1", "run_id": now, "mode": "dry-run" if dry_run else "load",
                     "date_from": str(args.date_from or ""), "date_to": str(args.date_to or ""), "workers": args.workers,
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
    ap.add_argument("--workers", type=int, default=min(4, os.cpu_count() or 1),
                    help="chunks of a big table loaded at the same time (default: 4, or fewer CPUs)")
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
    src = Source(env)
    tc = target_conn(env)
    print(f"{'DRY RUN - nothing is written' if args.dry_run else 'LOADING'}: {len(mapping)} tables -> {env['TGT_DATABASE']}.{schema}"
          f", reading {'the Postgres copy ' + src.schema if src.pg else 'SQL Server'}, {args.workers} worker(s)")
    summary, ok = {}, True
    progress = Progress(out, mapping, args.dry_run, args)
    progress.save()
    # spawn: each worker starts clean and opens its own connections (a forked copy would share this process's sockets)
    pool = ProcessPoolExecutor(args.workers, mp_context=multiprocessing.get_context("spawn")) if args.workers > 1 else None
    try:
        for m in mapping:
            t0 = time.time()
            print(f"  {m['source']} -> {m['target']}")
            try:
                s = migrate_table(m, src, tc, schema, args, state, out, env, progress, pool)
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
    finally:
        if pool:
            pool.shutdown(cancel_futures=True)
    (out / "summary.json").write_text(json.dumps(summary, indent=1, default=str))
    sums_ok = all(abs(Decimal(d["diff"])) < Decimal("0.005") for s in summary.values() for d in s.get("check_sums", {}).values())
    progress.save(finished=True, result="ok" if ok and sums_ok else "problems")
    print("\nSUMMARY (source -> read / loaded / rejected / warnings)")
    for s_name, s in summary.items():
        print(f"  {s_name:30} {s['read']:>9} {s['loaded']:>9} {s['rejected']:>7} {s['warnings']:>5}  in target {s.get('target_rows', '-'):>7}  rows {s['check_rows']}"
              + "".join(f"  {c} diff {d['diff']}" for c, d in s.get("check_sums", {}).items()))
    print(f"\nRejected rows: {out}/errors/<table>.<chunk>.csv   Warnings: {out}/warnings/   Summary: {out}/summary.json")
    sys.exit(0 if ok and sums_ok else 1)


if __name__ == "__main__":
    main()
