"""Suggests old -> new field matches for a report, by rule, and checks each one against the new database.

Input:
  1. old fields the report uses: a TSV with columns old_table, old_column
  2. the new database structure: extracts/new-db/master_columns.tsv (information_schema export)
Output (TSV on stdout): one row per old field with the suggested new table/column, how it was matched, and a status.

How a match is found, in order - the first rule that finds a real column in the new database wins:
  exact       same name, only lower-cased                         -> Auto
  snake_case  words split and joined with "_" (PaymentTypeName     -> Auto
              -> payment_type_name, HostLocationID -> host_location_id)
  squashed    same letters once every "_" is ignored               -> Review (a person confirms)
              (CTLOCATION -> ct_location)
  none        nothing found                                        -> Missing (a person maps it by hand)
Nothing is ever guessed beyond these rules.

Tables are different: old table names often break the rule (POS_ORDERPAYMENTS is all capitals, so it cannot be
split into pos_order_payments). A person confirms each table ONCE; confirmed tables are passed in with --tables and
their columns can then match automatically. Tables are shared between reports, so this is a one-off per table.

Usage:
  python3 tools/auto_map.py OLD_FIELDS.tsv NEW_DB_COLUMNS.tsv [--tables CONFIRMED_TABLES.tsv]
  CONFIRMED_TABLES.tsv has columns old_table, new_table (export of catalog.table_map where confirmed).
"""
import csv
import re
import sys
from collections import defaultdict


def snake(name: str) -> str:
    """PaymentTypeName -> payment_type_name; HostLocationID -> host_location_id; POS_ORDERPAYMENTS -> pos_orderpayments."""
    s = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', name)   # ...IDName -> ..._ID_Name
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s)         # typeName -> type_Name
    s = re.sub(r'[^A-Za-z0-9]+', '_', s)                  # spaces, dashes, "&" -> _
    return s.strip('_').lower()


def squash(name: str) -> str:
    return re.sub(r'[^a-z0-9]', '', name.lower())


def load_new(path):
    tables = defaultdict(dict)  # table -> column -> type
    for r in csv.DictReader(open(path), delimiter='\t'):
        tables[r['table_name']][r['column_name']] = r['data_type']
    return tables


def match(name, candidates):
    """Returns (matched_name, method) using the rules above, or (None, 'none')."""
    lower = name.lower()
    if lower in candidates:
        return lower, 'exact'
    s = snake(name)
    if s in candidates:
        return s, 'snake_case'
    squashed = {squash(c): c for c in candidates}
    if squash(name) in squashed:
        return squashed[squash(name)], 'squashed'
    return None, 'none'


STATUS = {'exact': 'Auto', 'snake_case': 'Auto', 'squashed': 'Review', 'none': 'Missing'}


def load_confirmed(path):
    if not path:
        return {}
    return {r['old_table']: r['new_table'] for r in csv.DictReader(open(path), delimiter='\t')}


def main(old_path, new_path, tables_path=None):
    new = load_new(new_path)
    confirmed = load_confirmed(tables_path)
    out = csv.writer(sys.stdout, delimiter='\t', lineterminator='\n')
    out.writerow(['old_table', 'old_column', 'new_table', 'table_method', 'new_column', 'column_method', 'new_type', 'status'])
    counts = defaultdict(int)
    for r in csv.DictReader(open(old_path), delimiter='\t'):
        if r['old_table'] in confirmed and confirmed[r['old_table']] in new:
            table, t_method = confirmed[r['old_table']], 'confirmed'
        else:
            table, t_method = match(r['old_table'], new.keys())
        if table is None:
            out.writerow([r['old_table'], r['old_column'], '', 'none', '', 'none', '', 'Missing'])
            counts['Missing'] += 1
            continue
        col, c_method = match(r['old_column'], new[table].keys())
        status = STATUS[c_method]
        if t_method not in ('confirmed', 'exact', 'snake_case') and status == 'Auto':
            status = 'Review'  # a table found only by the loose rule makes its columns "review" too
        out.writerow([r['old_table'], r['old_column'], table, t_method, col or '', c_method, new[table].get(col, ''), status])
        counts[status] += 1
    total = sum(counts.values())
    print(f"# {total} fields: {counts['Auto']} Auto, {counts['Review']} Review, {counts['Missing']} Missing", file=sys.stderr)


if __name__ == '__main__':
    args = sys.argv[1:]
    tables = None
    if '--tables' in args:
        i = args.index('--tables')
        tables = args[i + 1]
        del args[i:i + 2]
    main(args[0], args[1], tables)
