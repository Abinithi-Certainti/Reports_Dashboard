"""Turns a DEV export (CSV or TSV, with a header row) into demo/private-data/<report id>.json for the online copy.

Usage:  python3 tools/private_to_json.py <report id> <export file> [--cap 20000]

The output stays in demo/private-data/ (git-ignored - the repository is public). Numbers become numbers, empty cells
become null (also "NULL" and DBeaver's "(null)"). When the export has exactly --cap rows, the SQL tool most likely stopped at its row limit, so the file is
marked row_cap_hit and the dashboard says the totals are incomplete.
"""
import csv
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ["tender-report", "waste-report", "market-category", "sales-margin-budget", "sales-report-1",
           "sales-budget-2026", "sales-field-team", "financial-reports"]


def value(cell: str):
    cell = cell.strip()
    if cell == "" or cell.upper() in ("NULL", "(NULL)"):  # DBeaver writes an empty cell as (null)
        return None
    try:
        return int(cell) if cell.lstrip("-").isdigit() and not (len(cell) > 1 and cell.lstrip("-").startswith("0")) else float(cell)
    except ValueError:
        return cell


def main() -> None:
    args = sys.argv[1:]
    cap = 20000
    if "--cap" in args:
        i = args.index("--cap")
        cap = int(args[i + 1])
        del args[i:i + 2]
    if len(args) != 2 or args[0] not in REPORTS:
        sys.exit(f"usage: python3 tools/private_to_json.py <{'|'.join(REPORTS)}> <export file> [--cap N]")
    report_id, src = args[0], Path(args[1])
    text = src.read_text(encoding="utf-8-sig")
    # A character lost before the file reached us (shown as U+FFFD) becomes "?" and is reported, not guessed.
    lost = text.count("\ufffd")
    if lost:
        print(f"WARNING: {lost} unreadable character(s) in the export, shown as '?'")
        text = text.replace("\ufffd", "?")
    dialect = "excel-tab" if "\t" in text.splitlines()[0] else "excel"
    reader = csv.reader(text.splitlines(), dialect)
    header = [h.strip() for h in next(reader)]
    rows = [{h: value(c) for h, c in zip(header, line)} for line in reader if any(c.strip() for c in line)]
    # Packed to keep the one-file online copy small: text columns hold positions in a list of distinct values
    # (read back by engine/frontend/src/static/staticApi.ts).
    text_cols = [h for h in header if any(isinstance(r.get(h), str) for r in rows)]
    # A text column keeps every value as text (a "23" in it stays "23"), so each non-empty cell is a position.
    dicts = {h: sorted({str(r[h]) for r in rows if r.get(h) is not None}) for h in text_cols}
    pos = {h: {v: i for i, v in enumerate(d)} for h, d in dicts.items()}
    data = [[(pos[h][str(r[h])] if r.get(h) is not None else None) if h in pos else r.get(h) for h in header] for r in rows]
    out = ROOT / "demo" / "private-data" / f"{report_id}.json"
    out.write_text(json.dumps({
        "exported_on": date.fromtimestamp(src.stat().st_mtime).isoformat(),
        "source": "DEV database (kios_etl, schema master)",
        "row_cap_hit": len(rows) == cap,
        "columns": header,
        "dicts": dicts,
        "data": data,
    }, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}: {len(rows)} rows, {len(header)} columns"
          + (" - WARNING: exactly the row limit, the export is probably cut off" if len(rows) == cap else ""))


if __name__ == "__main__":
    main()
