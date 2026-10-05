-- Mock of the NEW Postgres tables (schema master), generated from the schema review. Test only.
CREATE SCHEMA IF NOT EXISTS master;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE master.order_type_name_enum AS ENUM ('Mobile - Take Out', 'Eat In', 'Drive-Thru', 'Digital Order', 'Cash Drop', 'Take Out', 'Mobile - Drive Thru', 'Paid Out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TABLE IF EXISTS master.netsuite_location_mapping;
CREATE TABLE master.netsuite_location_mapping (
    "location_id" integer NOT NULL,
    "pre_acquisition" character varying(255),
    "post_acquisition" character varying(255),
    "acquisition_date" timestamp without time zone,
    "company" character varying(255),
    "location" character varying(255),
    "location_name" character varying(255),
    "brand" character varying(255),
    "brand_name" character varying(255),
    "ct_location" character varying(100),
    "ct_brand" character varying(100),
    "ns_dept_id" integer,
    "rollout" character varying(50),
    "host_location_id" integer,
    "guid" character varying(150),
    "store_id" character varying(50),
    "brand_w_dt" integer,
    "no_of_type" integer,
    "created_timestamp" timestamp without time zone,
    "updated_timestamp" timestamp without time zone,
    "location_id_src" character varying(20)
);
DROP TABLE IF EXISTS master.district_directors;
CREATE TABLE master.district_directors (
    "plaza" character varying(50),
    "district" character varying(50),
    "district_director" character varying(100),
    "host_location_id" integer
);
DROP TABLE IF EXISTS master.date_table;
CREATE TABLE master.date_table (
    "day_id" integer NOT NULL,
    "date" date NOT NULL,
    "week" integer,
    "month" integer,
    "year" integer,
    "day_of_month" integer,
    "day_of_week" integer,
    "weekday" character varying(20),
    "start_of_week" date,
    "end_of_week" date,
    "retail_week_of_year" integer,
    "retail_period" integer,
    "retail_year" integer,
    "retail_period_start_date" date,
    "retail_period_end_date" date
);
DROP TABLE IF EXISTS master.weekly_cogs_prod_num;
CREATE TABLE master.weekly_cogs_prod_num (
    "product_name" character varying(500),
    "product_num" character varying(100) NOT NULL,
    "category" character varying(255) NOT NULL DEFAULT ''::character varying,
    "sub_category" character varying(255) NOT NULL DEFAULT ''::character varying,
    "micro_category" character varying(255) DEFAULT ''::character varying,
    "inv_unit" character varying(100) NOT NULL DEFAULT ''::character varying,
    "created_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "updated_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    PRIMARY KEY ("product_num")
);
CREATE SEQUENCE IF NOT EXISTS master.temp_dlh_id_seq;
DROP TABLE IF EXISTS master.temp_dlh;
CREATE TABLE master.temp_dlh (
    "plaza" character varying(50),
    "brand" character varying(50),
    "dlh_date" date,
    "dlh" numeric(10,4),
    "id" bigint NOT NULL DEFAULT nextval('master.temp_dlh_id_seq'::regclass),
    "created_by" character varying(100),
    "updated_by" character varying(100),
    "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.vena_sales;
CREATE TABLE master.vena_sales (
    "Region" character varying(50) NOT NULL,
    "Location" character varying(50) NOT NULL,
    "Brand" character varying(50) NOT NULL,
    "value" numeric(10,3),
    "TimePeriod" character varying(50),
    "TimePeriod_Date" date NOT NULL,
    "HostLocationID" smallint NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "updated_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "budget_year" integer NOT NULL,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.vena_gross_margin;
CREATE TABLE master.vena_gross_margin (
    "Region" character varying(50) NOT NULL,
    "Location" character varying(50) NOT NULL,
    "Brand" character varying(50) NOT NULL,
    "value" double precision,
    "TimePeriod" character varying(50),
    "TimePeriod_Date" date NOT NULL,
    "HostLocationID" smallint NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "updated_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "budget_year" integer NOT NULL,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.vena_transactions;
CREATE TABLE master.vena_transactions (
    "Region" character varying(50) NOT NULL,
    "Location" character varying(50) NOT NULL,
    "Brand" character varying(50) NOT NULL,
    "value" double precision,
    "TimePeriod" date NOT NULL,
    "TimePeriod_Date" date NOT NULL,
    "HostLocationID" smallint NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "updated_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "budget_year" integer NOT NULL,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.vena_labour_hours;
CREATE TABLE master.vena_labour_hours (
    "Region" character varying(50) NOT NULL,
    "Location" character varying(50) NOT NULL,
    "Brand" character varying(50) NOT NULL,
    "value" double precision,
    "TimePeriod" date NOT NULL,
    "TimePeriod_Date" date NOT NULL,
    "HostLocationID" smallint NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "updated_by" character varying(100) NOT NULL DEFAULT 'SYSTEM'::character varying,
    "budget_year" integer NOT NULL,
    PRIMARY KEY ("id")
);
CREATE SEQUENCE IF NOT EXISTS master.weekly_cogs_id_seq;
DROP TABLE IF EXISTS master.weekly_cogs;
CREATE TABLE master.weekly_cogs (
    "id" bigint NOT NULL DEFAULT nextval('master.weekly_cogs_id_seq'::regclass),
    "loc_code" character varying(20) NOT NULL,
    "start_date" date,
    "period" date NOT NULL,
    "product_num" character varying(100),
    "unit_price" numeric(18,4),
    "begin_quantity" numeric(18,4),
    "begin_value" numeric(18,4),
    "purchase_quantity" numeric(18,4),
    "purchase_value" numeric(15,2),
    "inv_adj_quantity" numeric(18,4),
    "inv_adj_value" numeric(18,4),
    "waste_quantity" numeric(18,4),
    "waste_value" numeric(18,4),
    "var_adj_quantity" numeric(18,4),
    "var_adj_value" numeric(18,4),
    "transfer_out_quantity" numeric(18,4),
    "transfer_out_value" numeric(18,4),
    "end_quantity" numeric(18,4),
    "end_value" numeric(15,2),
    "cogs" numeric(15,2),
    "theo_depletion" numeric(18,4),
    "theo_cost" numeric(18,4),
    "created_by" character varying(100),
    "updated_by" character varying(100),
    "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.employee_pay_summary;
CREATE TABLE master.employee_pay_summary (
    "employee_number" character varying(50) NOT NULL,
    "employee_name" character varying(100) NOT NULL,
    "pay_date" character varying(20) NOT NULL,
    "location" character varying(200),
    "department" character varying(200),
    "job" character varying(200),
    "pay_code" character varying(100),
    "pay_category" character varying(100),
    "hours" numeric(10,4),
    "rounded_in_out" character varying(30),
    "pay_amount" numeric(14,4),
    "retrieve_date" character varying(30) NOT NULL,
    "created_timestamp" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_timestamp" timestamp without time zone
);
DROP TABLE IF EXISTS master.pos_order_paid_outs;
CREATE TABLE master.pos_order_paid_outs (
    "order_detail_id" integer NOT NULL,
    "order_id" bigint NOT NULL,
    "menu_item_id" integer NOT NULL,
    "menu_item_name" character varying(60),
    "entered_time" timestamp without time zone,
    "order_type_name" master.order_type_name_enum,
    "order_type" smallint,
    "finish_on" timestamp without time zone,
    "end_day" timestamp without time zone,
    "payment_amount" numeric(9,2),
    "guid" uuid NOT NULL,
    "store_id" character varying(20) NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.pos_orders;
CREATE TABLE master.pos_orders (
    "order_id" bigint NOT NULL,
    "start_on" timestamp without time zone,
    "finish_on" timestamp without time zone,
    "order_type_name" master.order_type_name_enum,
    "order_type" smallint,
    "tax" numeric(9,2),
    "subtotal" numeric(9,2),
    "grand_total" numeric(9,2),
    "total" numeric(9,2),
    "discount" numeric(9,2),
    "combo_saved" numeric(9,2),
    "is_refund" boolean,
    "end_day" timestamp without time zone,
    "gross" numeric(9,2),
    "net" numeric(9,2),
    "receipt_number" integer,
    "order_number_id" integer,
    "start_person" character varying(60),
    "close_person" character varying(60),
    "start_person_employee_id" integer,
    "close_person_employee_id" integer,
    "third_party_order_id" character varying(60),
    "target_computer" character varying(60),
    "guid" uuid NOT NULL,
    "store_id" character varying(20) NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.pos_order_payments;
CREATE TABLE master.pos_order_payments (
    "order_id" bigint NOT NULL,
    "finish_on" timestamp without time zone,
    "end_day" timestamp without time zone,
    "payment_type_id" smallint,
    "payment_amount" numeric(9,2),
    "gratuity" numeric(9,2),
    "penny_rounded" numeric(9,2),
    "use_penny_rounding" boolean,
    "exchange_rate" numeric(9,4),
    "payment_type_name" character varying(50),
    "guid" uuid NOT NULL,
    "store_id" character varying(20) NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS master.pos_order_details;
CREATE TABLE master.pos_order_details (
    "order_detail_id" integer NOT NULL,
    "order_id" bigint NOT NULL,
    "menu_item_id" integer NOT NULL,
    "menu_item_name" character varying(60),
    "kitchen_name" character varying(60),
    "menu_item_type" character varying(10),
    "plu" character varying(20),
    "price" numeric(9,2),
    "quantity" integer,
    "department_id" integer,
    "department_name" character varying(60),
    "discount_id" integer,
    "discount_value" numeric(9,2),
    "discount_amount" numeric(9,2),
    "has_mods" boolean,
    "sequence" integer,
    "entered_time" timestamp without time zone,
    "tax_exemption" boolean,
    "tax_quantity" numeric(9,2),
    "deposit" boolean,
    "value_added_base_price" numeric(9,2),
    "combo_discounted_price" numeric(9,2),
    "alc_price" numeric(9,2),
    "alc_max_price" numeric(9,2),
    "alc_remaining_price" numeric(9,2),
    "pricing_group_plu" character varying(60),
    "pricing_group_name" character varying(60),
    "upgrade_amount" numeric(9,2),
    "combo_percent_based_price" numeric(9,2),
    "combo_percent_based_discount_price" numeric(9,2),
    "order_type_name" master.order_type_name_enum,
    "order_type" smallint,
    "finish_on" timestamp without time zone,
    "end_day" timestamp without time zone,
    "discount_type" character varying(60),
    "price_backup" numeric(9,2),
    "max_order_detail_id" integer,
    "persistent_plu" integer,
    "guid" uuid NOT NULL,
    "store_id" character varying(20) NOT NULL,
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    PRIMARY KEY ("id")
);
