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
}
