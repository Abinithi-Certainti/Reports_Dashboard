package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;
import com.certainti.reports.spec.ReportSpec.Dimension;
import com.certainti.reports.spec.ReportSpec.Measure;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqlBuilderTest {

    private static ReportSpec spec() {
        Map<String, Dimension> dims = new LinkedHashMap<>();
        dims.put("plaza", new Dimension("Plaza", "plaza", null, null));
        dims.put("payment_type", new Dimension("Payment Type", "payment_type", null, "sequence"));
        dims.put("end_day", new Dimension("Date", "end_day", "date", null));
        Map<String, Measure> measures = Map.of("amount", new Measure("Amount", "sum(amount)", "currency"));
        return new ReportSpec("t", "T", null, "dataset.sql", null, dims, measures, Map.of(), List.of(), List.of(),
                "SELECT 1");
    }

    private static QueryRequest request(Map<String, List<String>> filters, List<String> groupBy, List<String> measures) {
        return new QueryRequest(filters, null, "2025-01-01", "2025-01-31", groupBy, measures, null);
    }

    @Test
    void filterValuesAreBoundNotConcatenated() {
        String attack = "x'); DROP TABLE users; --";
        SqlBuilder.Built built = SqlBuilder.build(spec(),
                request(Map.of("plaza", List.of(attack)), List.of("plaza"), List.of("amount")));
        assertThat(built.sql()).doesNotContain("DROP TABLE");
        assertThat(built.params()).hasSize(3);
        assertThat((String[]) built.params().get(0)).containsExactly(attack);
        assertThat(built.params().get(1)).isEqualTo(LocalDate.parse("2025-01-01"));
    }

    @Test
    void unknownDimensionIsRejected() {
        assertThatThrownBy(() -> SqlBuilder.build(spec(),
                request(Map.of(), List.of("plaza; drop table x"), List.of("amount"))))
                .isInstanceOf(SqlBuilder.BadRequest.class);
    }

    @Test
    void unknownMeasureIsRejected() {
        assertThatThrownBy(() -> SqlBuilder.build(spec(), request(Map.of(), List.of(), List.of("secret_column"))))
                .isInstanceOf(SqlBuilder.BadRequest.class);
    }

    @Test
    void badDateIsRejected() {
        QueryRequest r = new QueryRequest(null, null, "2025-01-01' OR 1=1", null, List.of(), List.of("amount"), null);
        assertThatThrownBy(() -> SqlBuilder.build(spec(), r)).isInstanceOf(SqlBuilder.BadRequest.class);
    }

    @Test
    void sortsBySortColumnWhenTheSpecSaysSo() {
        SqlBuilder.Built built = SqlBuilder.build(spec(), request(Map.of(), List.of("payment_type"), List.of("amount")));
        assertThat(built.sql()).contains("ORDER BY min(d.sequence) NULLS LAST, d.payment_type NULLS LAST");
    }

    @Test
    void emptyFilterMeansAll() {
        SqlBuilder.Built built = SqlBuilder.build(spec(),
                request(Map.of("plaza", List.of()), List.of(), List.of("amount")));
        assertThat(built.sql()).doesNotContain("ANY");
    }
}
