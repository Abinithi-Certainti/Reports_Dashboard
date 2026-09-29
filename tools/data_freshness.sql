-- When does each report's data get updated?  READ-ONLY: three SELECTs, nothing else.
-- Run in DBeaver on the kios_etl database, one query at a time (put the cursor in it, Ctrl+Enter), and export each
-- result (Execute -> Export from Query -> CSV).
--
-- Where the answers come from (kios-ngmw-orchestration, branch develop):
--   master.flow_definition        one row per ETL flow; its timing is flow_config -> schedule_config -> cron_expression
--                                 (Quartz cron: seconds minutes hours day-of-month month day-of-week)
--   control_center.flow_execution one row per run: start_time, end_time, status, records_processed
-- If query 2 says control_center.flow_execution does not exist, that schema is in the orchestration service's own
-- database: run query 2 there instead.

-- 1. The planned schedule of every ETL flow
SELECT fd.flow_code,
       fd.flow_name,
       fd.trigger_type,
       fd.status,
       coalesce(fd.flow_config -> 'schedule_config' ->> 'cron_expression',
                fd.flow_config -> 'scheduleConfig' ->> 'cronExpression') AS cron_expression,
       fd.updated_at
FROM master.flow_definition fd
ORDER BY fd.flow_code;

-- 2. What actually ran in the last 14 days, per flow: how often, at what times, how long, how many failed
SELECT fd.flow_code,
       fe.trigger_type,
       count(*)                                                        AS runs,
       count(*) FILTER (WHERE fe.status::text ILIKE '%fail%')          AS failed_runs,
       min(fe.start_time)                                              AS first_start,
       max(fe.start_time)                                              AS last_start,
       max(fe.end_time)                                                AS last_end,
       string_agg(DISTINCT to_char(fe.start_time, 'HH24:MI'), ', ')    AS start_times_seen,
       round(avg(extract(epoch FROM fe.end_time - fe.start_time)) / 60, 1) AS avg_minutes,
       sum(fe.records_processed)                                       AS records_processed
FROM control_center.flow_execution fe
LEFT JOIN master.flow_definition fd ON fd.flow_id::text = fe.flow_id::text
WHERE fe.start_time >= now() - interval '14 days'
GROUP BY fd.flow_code, fe.trigger_type
ORDER BY fd.flow_code;

-- 3. When each report's source tables last received data, and the latest business day they hold
SELECT 'pos_orders' AS source_table, 'Sales Report, Budget 2026, Field Team, Sales and Margin, Financial' AS used_by,
       max(created_at) AS last_inserted, max(updated_at) AS last_updated, max(end_day)::date AS latest_business_day FROM master.pos_orders
UNION ALL SELECT 'pos_order_details', 'Market Category, Sales and Margin, Financial, Sales reports',
       max(created_at), max(updated_at), max(end_day)::date FROM master.pos_order_details
UNION ALL SELECT 'pos_order_payments', 'Tender', max(created_at), max(updated_at), max(end_day)::date FROM master.pos_order_payments
UNION ALL SELECT 'pos_order_paid_outs', 'Tender, Financial', max(created_at), max(updated_at), max(end_day)::date FROM master.pos_order_paid_outs
UNION ALL SELECT 'weekly_cogs', 'Waste, Market Category, Sales and Margin', max(created_at), max(updated_at), NULL FROM master.weekly_cogs
UNION ALL SELECT 'weekly_cogs_prod_num', 'Waste, Market Category', max(created_timestamp), max(updated_timestamp), NULL FROM master.weekly_cogs_prod_num
UNION ALL SELECT 'vena_sales', 'Sales and Margin, Budget 2026', max(created_timestamp), max(updated_timestamp), NULL FROM master.vena_sales
UNION ALL SELECT 'vena_gross_margin', 'Sales and Margin', max(created_timestamp), max(updated_timestamp), NULL FROM master.vena_gross_margin
UNION ALL SELECT 'vena_transactions', 'Budget 2026', max(created_timestamp), max(updated_timestamp), NULL FROM master.vena_transactions
UNION ALL SELECT 'vena_labour_hours', 'Budget 2026', max(created_timestamp), max(updated_timestamp), NULL FROM master.vena_labour_hours
UNION ALL SELECT 'employee_pay_summary', 'Sales Report, Budget 2026, Field Team (labour)', max(created_at), max(updated_at), NULL FROM master.employee_pay_summary
UNION ALL SELECT 'temp_dlh', 'Sales Report, Budget 2026, Field Team (labour)', max(created_at), max(updated_at), NULL FROM master.temp_dlh
UNION ALL SELECT 'netsuite_location_mapping', 'every report (plaza and brand names)', max(created_timestamp), max(updated_timestamp), NULL FROM master.netsuite_location_mapping
ORDER BY 1;
