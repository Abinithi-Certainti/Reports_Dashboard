-- The retail calendar, shared by every report with "calendar: retail". One row per day.
-- Source: master.date_table (found on DEV 2026-09-25, the same table the Power BI "Date" query reads).
-- Weeks run Sunday to Saturday. Periods are 4-4-5 weeks. year_start = first day of the retail year, the same as the
-- Power BI column "first retail week by year" (MIN of Retail_Period_Start_Date per Retail_Year).
-- No semicolons anywhere in this file, comments included: the engine wraps it as WITH c AS (...).
SELECT dt.date                                                     AS day
     , dt.retail_year
     , dt.retail_period
     , dt.retail_week_of_year                                      AS retail_week
     , dt.start_of_week                                            AS week_start
     , dt.end_of_week                                              AS week_end
     , dt.retail_period_start_date                                 AS period_start
     , min(dt.retail_period_start_date) OVER (PARTITION BY dt.retail_year) AS year_start
FROM master.date_table dt
