-- 001_catalog_schema.sql
-- Report catalog: stores what each old Power BI report is made of, and how it maps to the new PostgreSQL model.
-- Structure only. No production data rows are ever stored here.
-- Rollback: 001_catalog_schema.rollback.sql

CREATE SCHEMA IF NOT EXISTS catalog;

-- One row per old Power BI report.
CREATE TABLE catalog.report (
    report_id        serial PRIMARY KEY,
    report_name      text NOT NULL UNIQUE,
    workspace        text,
    owner            text,
    source_server    text,
    source_database  text,
    source_schema    text,
    extracted_on     date,
    extraction_method text,
    status           text NOT NULL DEFAULT 'extracted'
                     CHECK (status IN ('extracted', 'mapped', 'rebuilt', 'verified', 'retired')),
    notes            text
);

-- Tables inside the report's data model (what Power BI calls a table).
CREATE TABLE catalog.model_table (
    model_table_id   serial PRIMARY KEY,
    report_id        int  NOT NULL REFERENCES catalog.report ON DELETE CASCADE,
    table_name       text NOT NULL,
    table_kind       text NOT NULL CHECK (table_kind IN ('source', 'dax', 'auto_date', 'placeholder')),
    is_hidden        boolean NOT NULL DEFAULT false,
    source_query     text,          -- SQL sent to the old database
    transform_steps  text,          -- Power Query steps applied after the SQL, in order
    dax_expression   text,          -- for DAX-calculated tables
    UNIQUE (report_id, table_name)
);

-- Columns of each model table.
CREATE TABLE catalog.model_column (
    model_column_id  serial PRIMARY KEY,
    model_table_id   int  NOT NULL REFERENCES catalog.model_table ON DELETE CASCADE,
    column_name      text NOT NULL,
    data_type        text,
    column_kind      text NOT NULL CHECK (column_kind IN ('data', 'calculated', 'calc_table')),
    is_hidden        boolean NOT NULL DEFAULT false,
    sort_by_column   text,
    dax_expression   text,
    UNIQUE (model_table_id, column_name)
);

-- DAX measures.
CREATE TABLE catalog.measure (
    measure_id       serial PRIMARY KEY,
    report_id        int  NOT NULL REFERENCES catalog.report ON DELETE CASCADE,
    measure_name     text NOT NULL,
    home_table       text,
    dax_expression   text NOT NULL,
    format_string    text,
    is_hidden        boolean NOT NULL DEFAULT false,
    plain_english    text,
    UNIQUE (report_id, measure_name)
);

-- Relationships between model tables.
CREATE TABLE catalog.relationship (
    relationship_id  serial PRIMARY KEY,
    report_id        int  NOT NULL REFERENCES catalog.report ON DELETE CASCADE,
    from_table       text NOT NULL,
    from_column      text NOT NULL,
    to_table         text NOT NULL,
    to_column        text NOT NULL,
    cardinality      text NOT NULL DEFAULT 'many_to_one',
    cross_filter     text NOT NULL CHECK (cross_filter IN ('one_direction', 'both_directions')),
    is_active        boolean NOT NULL DEFAULT true
);

-- Visuals on each page, including slicers.
CREATE TABLE catalog.visual (
    visual_id        serial PRIMARY KEY,
    report_id        int  NOT NULL REFERENCES catalog.report ON DELETE CASCADE,
    page_name        text NOT NULL,
    visual_order     int  NOT NULL,
    visual_type      text NOT NULL,   -- slicer_dropdown, slicer_date_range, table, matrix, card, bar, line, pie ...
    title            text,
    fields           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- rows / columns / values / field, by role
    UNIQUE (report_id, page_name, visual_order)
);

-- Business rules hidden in the report that the new build must keep (or deliberately change).
CREATE TABLE catalog.business_rule (
    rule_id          serial PRIMARY KEY,
    report_id        int  NOT NULL REFERENCES catalog.report ON DELETE CASCADE,
    rule_text        text NOT NULL,
    found_in         text NOT NULL,
    decision         text NOT NULL DEFAULT 'keep' CHECK (decision IN ('keep', 'drop', 'change', 'pending'))
);

-- Problems found in the old report.
CREATE TABLE catalog.finding (
    finding_id       serial PRIMARY KEY,
    report_id        int  NOT NULL REFERENCES catalog.report ON DELETE CASCADE,
    severity         text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    finding_text     text NOT NULL,
    verified         boolean NOT NULL,
    status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'decided', 'closed')),
    decision_owner   text,
    decision         text
);

-- Old table -> new table. Shared across reports.
CREATE TABLE catalog.table_map (
    table_map_id     serial PRIMARY KEY,
    old_schema       text NOT NULL,
    old_table        text NOT NULL,
    new_schema       text,
    new_table        text,
    evidence         text NOT NULL,
    confirmed        boolean NOT NULL DEFAULT false,
    UNIQUE (old_schema, old_table)
);

-- Old column -> new column. Shared across reports. Filled from a real comparison of both databases, never guessed.
CREATE TABLE catalog.column_map (
    column_map_id    serial PRIMARY KEY,
    table_map_id     int  NOT NULL REFERENCES catalog.table_map ON DELETE CASCADE,
    old_column       text NOT NULL,
    old_data_type    text,
    new_column       text,
    new_data_type    text,
    match_method     text CHECK (match_method IN ('exact', 'snake_case', 'manual')),
    confirmed_by     text,
    UNIQUE (table_map_id, old_column)
);
