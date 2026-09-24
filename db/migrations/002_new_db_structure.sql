-- 002_new_db_structure.sql
-- Holds the structure (not data) of the new PostgreSQL database, so old -> new matching can be done by query.
-- Rollback: 002_new_db_structure.rollback.sql

CREATE TABLE catalog.new_db_column (
    schema_name      text NOT NULL,
    table_name       text NOT NULL,
    column_name      text NOT NULL,
    data_type        text NOT NULL,
    ordinal_position int  NOT NULL,
    PRIMARY KEY (schema_name, table_name, column_name)
);
