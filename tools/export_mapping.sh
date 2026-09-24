#!/usr/bin/env bash
# Exports one report's old -> new field mapping from the catalog DB into reports/<id>/mapping.json,
# which the engine's Mapping Studio page shows. Re-run after the catalog changes.
# Usage: bash tools/export_mapping.sh "Tender Report" reports/tender-report/mapping.json
set -euo pipefail
REPORT_NAME="${1:?report name as stored in catalog.report}"
OUT="${2:?output file}"
PORT="${PGPORT:-5434}"

psql -h /tmp -p "$PORT" -U postgres -d report_catalog -v ON_ERROR_STOP=1 -qtA -v name="$REPORT_NAME" <<'SQL' > "$OUT"
WITH r AS (SELECT * FROM catalog.report WHERE report_name = :'name'),
used_tables AS (
    -- the old tables this report reads, found in its source SQL
    SELECT DISTINCT tm.* FROM catalog.table_map tm, catalog.model_table mt, r
    WHERE mt.report_id = r.report_id AND mt.source_query ILIKE '%' || tm.old_table || '%'
)
SELECT jsonb_pretty(jsonb_build_object(
  'report', (SELECT report_name FROM r),
  'source', (SELECT jsonb_build_object('server', source_server, 'database', source_database, 'schema', source_schema) FROM r),
  'target', jsonb_build_object('database', 'kios_etl', 'schema', 'master'),
  'extracted_on', (SELECT extracted_on FROM r),
  'tables', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'old_table', t.old_table, 'new_table', t.new_table, 'confirmed', t.confirmed, 'evidence', t.evidence,
        'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'old_column', c.old_column, 'new_column', c.new_column, 'new_type', c.new_data_type,
              'method', c.match_method, 'confirmed_by', c.confirmed_by) ORDER BY c.column_map_id), '[]')
            FROM catalog.column_map c WHERE c.table_map_id = t.table_map_id)
      ) ORDER BY t.table_map_id), '[]') FROM used_tables t),
  'rules', (SELECT coalesce(jsonb_agg(jsonb_build_object('rule', rule_text, 'found_in', found_in, 'decision', decision) ORDER BY rule_id), '[]')
            FROM catalog.business_rule b, r WHERE b.report_id = r.report_id),
  'findings', (SELECT coalesce(jsonb_agg(jsonb_build_object('severity', f.severity, 'finding', f.finding_text, 'verified', f.verified,
                 'status', f.status, 'decision_owner', f.decision_owner) ORDER BY f.finding_id), '[]')
               FROM catalog.finding f, r WHERE f.report_id = r.report_id)
));
SQL
echo "Wrote $OUT"
