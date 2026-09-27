package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;
import com.certainti.reports.spec.ReportSpec.Dimension;
import com.certainti.reports.spec.ReportSpec.Measure;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WindowsTest {

    private static ReportSpec spec() {
        Map<String, Measure> m = new LinkedHashMap<>();
        m.put("sales", new Measure("Sales", "sum(sales)", "currency"));
        m.put("wtd_sales", new Measure("WTD", null, "currency", "wtd", "sales"));
        m.put("ytd_sales", new Measure("YTD", null, "currency", "ytd", "sales"));
        return new ReportSpec("t", "T", null, "dataset.sql", null, Map.of("plaza", new Dimension("Plaza", "plaza", null, null)),
                m, Map.of(), List.of(), List.of(), "retail", "SELECT 1", "SELECT 1");
    }

    private static Map<String, Object> row(Object plaza, String measure, Object value) {
        Map<String, Object> r = new HashMap<>();
        r.put("plaza", plaza);
        r.put(measure, value);
        return r;
    }

    @Test
    void splitsByWindowWidestFirst() {
        Map<String, List<String>> split = Windows.split(spec(), List.of("wtd_sales", "sales", "ytd_sales"));
        assertThat(split.keySet()).containsExactly("ytd", "wtd", "");
    }

    @Test
    void windowStartsComeFromTheCalendar() {
        Map<String, Object> starts = Map.of("week_start", "2026-09-06", "period_start", "2026-08-23", "year_start", "2025-12-28");
        assertThat(Windows.start("wtd", starts, "x")).isEqualTo("2026-09-06");
        assertThat(Windows.start("ptd", starts, "x")).isEqualTo("2026-08-23");
        assertThat(Windows.start("ytd", starts, "x")).isEqualTo("2025-12-28");
        assertThat(Windows.start("", starts, "2026-09-01")).isEqualTo("2026-09-01");
    }

    @Test
    void mergesOnTheGroupKeyIncludingNullKeys() {
        List<Map<String, Object>> ytd = new ArrayList<>(List.of(row("A", "ytd_sales", 100), row(null, "ytd_sales", 7), row("B", "ytd_sales", 50)));
        List<Map<String, Object>> wtd = new ArrayList<>(List.of(row("B", "wtd_sales", 5), row(null, "wtd_sales", 1)));
        List<Map<String, Object>> out = Windows.merge(List.of("plaza"), List.of("wtd_sales", "ytd_sales"), List.of(ytd, wtd));
        assertThat(out).hasSize(3);
        assertThat(out.get(0)).containsEntry("plaza", "A").containsEntry("ytd_sales", 100).containsEntry("wtd_sales", null);
        assertThat(out.get(1)).containsEntry("plaza", null).containsEntry("ytd_sales", 7).containsEntry("wtd_sales", 1);
        assertThat(out.get(2)).containsEntry("plaza", "B").containsEntry("ytd_sales", 50).containsEntry("wtd_sales", 5);
    }

    @Test
    void aTotalWithNoRowsStillHasOneRow() {
        List<Map<String, Object>> out = Windows.merge(List.of(), List.of("wtd_sales"), List.of(List.of()));
        assertThat(out).hasSize(1);
        assertThat(out.get(0)).containsEntry("wtd_sales", null);
        assertThat(Arrays.asList(out.get(0).keySet().toArray())).containsExactly("wtd_sales");
    }

    @Test
    void aWindowedMeasureUsesItsBaseSql() {
        assertThat(SqlBuilder.measureSql(spec(), "wtd_sales")).isEqualTo("sum(sales)");
    }
}
