package com.certainti.reports.spec;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** An uploaded report must never be able to change data or reach an unknown field. */
class ImportValidationTest {

    @TempDir
    Path tmp;

    private static final String YAML = """
            id: paidout-report
            title: Paid-outs
            dataset: dataset.sql
            dimensions:
              plaza: { label: Plaza, column: plaza }
            measures:
              amount: { label: Amount, sql: "sum(amount)", format: currency }
            visuals:
              - { type: table, title: By plaza, rows: [plaza], values: [amount] }
            """;

    private ReportRegistry registry() {
        return new ReportRegistry(tmp.toString(), tmp.resolve("imported").toString());
    }

    @Test
    void acceptsAPlainSelect() {
        ReportSpec spec = registry().parse(YAML, "WITH x AS (SELECT 1 AS amount, 'A' AS plaza) SELECT * FROM x;");
        assertThat(spec.id()).isEqualTo("paidout-report");
        assertThat(spec.datasetSql()).doesNotEndWith(";");
    }

    @Test
    void rejectsSqlThatWrites() {
        assertThatThrownBy(() -> registry().parse(YAML, "DELETE FROM master.pos_order_payments"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("SELECT");
        assertThatThrownBy(() -> registry().parse(YAML, "SELECT 1; DROP TABLE x"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("single statement");
        assertThatThrownBy(() -> registry().parse(YAML, "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("only read");
    }

    @Test
    void rejectsAVisualThatUsesAnUnknownField() {
        String bad = YAML.replace("rows: [plaza]", "rows: [district]");
        assertThatThrownBy(() -> registry().parse(bad, "SELECT 1 AS amount, 'A' AS plaza"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("unknown dimension district");
    }

    @Test
    void rejectsABadReportId() {
        String bad = YAML.replace("id: paidout-report", "id: ../../etc");
        assertThatThrownBy(() -> registry().parse(bad, "SELECT 1 AS amount, 'A' AS plaza"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("id must be");
    }

    @Test
    void rejectsBrokenYaml() {
        assertThatThrownBy(() -> registry().parse("id: [unclosed", "SELECT 1"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not valid YAML");
    }

    @Test
    void acceptsTheNewVisualTypes() {
        String ok = YAML.replace("visuals:\n", "visuals:\n"
                + "  - { type: donut, title: Share, rows: [plaza], values: [amount], span: 4 }\n"
                + "  - { type: leaderboard, title: Top, rows: [plaza], values: [amount], limit: 5 }\n");
        assertThat(registry().parse(ok, "SELECT 1 AS amount, 'A' AS plaza").visuals()).hasSize(3);
    }

    @Test
    void rejectsAnUnknownVisualTypeOrBadWidth() {
        assertThatThrownBy(() -> registry().parse(YAML.replace("type: table", "type: pie3d"), "SELECT 1 AS amount, 'A' AS plaza"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("visual type must be one of");
        assertThatThrownBy(() -> registry().parse(YAML.replace("type: table,", "type: table, span: 13,"), "SELECT 1 AS amount, 'A' AS plaza"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("span must be 1 to 12");
    }

    private static final String WINDOWED = """
            id: sales-margin
            title: Sales
            dataset: dataset.sql
            calendar: retail
            dimensions:
              plaza: { label: Plaza, column: plaza }
              day:   { label: Day, column: day, type: date }
            measures:
              sales:     { label: Sales $, sql: "sum(sales)", format: currency }
              wtd_sales: { label: WTD Sales $, of: sales, window: wtd, format: currency }
            filters:
              - { dimension: day, type: retail_week }
            visuals:
              - { type: table, title: By plaza, rows: [plaza], values: [wtd_sales] }
            """;

    private ReportRegistry registryWithCalendar() throws java.io.IOException {
        java.nio.file.Files.createDirectories(tmp.resolve("_shared"));
        java.nio.file.Files.writeString(tmp.resolve("_shared").resolve("retail_calendar.sql"),
                "SELECT d AS day FROM generate_series(1, 2) d;");
        return registry();
    }

    @Test
    void acceptsAWindowedMeasureWithTheRetailCalendar() throws Exception {
        ReportSpec spec = registryWithCalendar().parse(WINDOWED, "SELECT 1 AS sales, 'A' AS plaza, current_date AS day");
        assertThat(spec.calendarSql()).startsWith("SELECT").doesNotContain(";");
        assertThat(spec.measures().get("wtd_sales").isWindowed()).isTrue();
    }

    @Test
    void rejectsWindowsWithoutACalendarOrABadBase() throws Exception {
        String sql = "SELECT 1 AS sales, 'A' AS plaza, current_date AS day";
        assertThatThrownBy(() -> registry().parse(WINDOWED, sql))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("retail_calendar.sql");
        ReportRegistry r = registryWithCalendar();
        assertThatThrownBy(() -> r.parse(WINDOWED.replace("calendar: retail\n", ""), sql))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("needs calendar: retail");
        assertThatThrownBy(() -> r.parse(WINDOWED.replace("window: wtd", "window: qtd"), sql))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("window must be one of");
        assertThatThrownBy(() -> r.parse(WINDOWED.replace("of: sales", "of: wtd_sales"), sql))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("has its own sql");
        assertThatThrownBy(() -> r.parse(WINDOWED.replace("dimension: day, type: retail_week", "dimension: plaza, type: retail_week"), sql))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("needs a date dimension");
    }
}
