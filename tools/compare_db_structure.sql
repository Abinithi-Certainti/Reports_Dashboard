-- QA vs DEV comparison, part 1 of 2: the structure of schema master (tables, columns, types) plus an
-- ESTIMATED row count per table (from PostgreSQL's own statistics - no table is scanned, so it is fast).
-- READ-ONLY: a single SELECT. Run it on QA and on DEV, save each result as CSV:
--   qa_structure.csv and dev_structure.csv  -> attach both in the chat. Never paste a password.
-- Compare with: python3 tools/compare_db.py qa_structure.csv dev_structure.csv qa_coverage.csv dev_coverage.csv
SELECT c.table_name,
       c.column_name,
       c.data_type,
       c.ordinal_position,
       coalesce(s.n_live_tup, 0) AS est_rows
FROM information_schema.columns c
LEFT JOIN pg_stat_user_tables s ON s.schemaname = c.table_schema AND s.relname = c.table_name
WHERE c.table_schema = 'master'
ORDER BY c.table_name, c.ordinal_position
