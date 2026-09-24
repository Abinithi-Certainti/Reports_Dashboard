"""Prints CREATE TABLE statements for the new database's structure (schema master), from the
information_schema export in extracts/new-db/master_columns.tsv. Structure only - no data.
Usage: python3 tools/new_db_ddl.py extracts/new-db/master_columns.tsv | psql ..."""
import collections
import csv
import sys

cols = collections.defaultdict(list)
for r in csv.DictReader(open(sys.argv[1]), delimiter='\t'):
    t = 'text' if r['data_type'] in ('USER-DEFINED', 'ARRAY') else r['data_type']
    cols[r['table_name']].append((int(r['ordinal_position']), r['column_name'], t))
print('CREATE SCHEMA IF NOT EXISTS master;')
for tbl, cs in cols.items():
    body = ', '.join(f'"{c}" {t}' for _, c, t in sorted(cs))
    print(f'CREATE TABLE master."{tbl}" ({body});')
