"""Compares QA and DEV (schema master) from the CSV exports of tools/compare_db_structure.sql and
tools/compare_db_coverage.sql, and prints a Markdown report: tables and columns found in only one database,
columns whose type differs, and what data each report table holds.
Usage: python3 tools/compare_db.py qa_structure.csv dev_structure.csv [qa_coverage.csv dev_coverage.csv]
The report holds real row counts and dates: write it to demo/private-data/, never into git."""
import collections
import csv
import sys


def read(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=',\t;')
        return [{k.strip().lower(): (v or '').strip() for k, v in r.items()} for r in csv.DictReader(f, dialect=dialect)]


def structure(path):
    cols, rows = collections.defaultdict(dict), {}
    for r in read(path):
        cols[r['table_name']][r['column_name']] = r['data_type']
        rows[r['table_name']] = r.get('est_rows', '')
    return cols, rows


def table(head, body):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in body]
    return '\n'.join(out) if body else '_None._'


qa, qa_rows = structure(sys.argv[1])
dev, dev_rows = structure(sys.argv[2])
only_qa, only_dev = sorted(set(qa) - set(dev)), sorted(set(dev) - set(qa))
both = sorted(set(qa) & set(dev))

print('# QA vs DEV - schema master\n')
print(table(['', 'QA', 'DEV'], [['Tables', len(qa), len(dev)], ['Tables in both', len(both), len(both)],
                                ['Tables only here', len(only_qa), len(only_dev)]]))

print('\n## Tables only in DEV (missing in QA)\n')
print(table(['Table', 'Columns', 'DEV rows (estimate)'], [[t, len(dev[t]), dev_rows[t]] for t in only_dev]))
print('\n## Tables only in QA (missing in DEV)\n')
print(table(['Table', 'Columns', 'QA rows (estimate)'], [[t, len(qa[t]), qa_rows[t]] for t in only_qa]))

col_only, col_type = [], []
for t in both:
    for c in sorted(set(qa[t]) | set(dev[t])):
        q, d = qa[t].get(c), dev[t].get(c)
        if q is None or d is None:
            col_only.append([t, c, q or '**missing**', d or '**missing**'])
        elif q != d:
            col_type.append([t, c, q, d])
print('\n## Columns found in only one database (tables in both)\n')
print(table(['Table', 'Column', 'QA type', 'DEV type'], col_only))
print('\n## Columns whose type differs\n')
print(table(['Table', 'Column', 'QA type', 'DEV type'], col_type))
print('\n## Rows per table (estimate), tables in both\n')
print(table(['Table', 'QA rows', 'DEV rows'], [[t, qa_rows[t], dev_rows[t]] for t in both]))

if len(sys.argv) > 4:
    qc = {r['table_name']: r for r in read(sys.argv[3])}
    dc = {r['table_name']: r for r in read(sys.argv[4])}
    body = []
    for t in sorted(set(qc) | set(dc)):
        q, d = qc.get(t, {}), dc.get(t, {})
        cell = lambda r: 'missing' if r.get('exists', '').lower() in ('f', 'false', '0') else \
            f"{r.get('rows', '')} rows, {r.get('first_day', '')[:10] or '-'} to {r.get('last_day', '')[:10] or '-'}, " \
            f"{r.get('stores', '') or '-'} stores"
        body.append([t, cell(q), cell(d)])
    print('\n## Data held by the report tables (exact)\n')
    print(table(['Table', 'QA', 'DEV'], body))
