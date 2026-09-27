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
        m.put("sales_yoy", new Measure("YOY $", null, "currency", "yoy", "sales"));
        m.put("sales_yoy_pct", new Measure("YOY %", null, "percent", "yoy_pct", "sales"));
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
    void plansEachWindowWidestFirstWithHelpersForYoy() {
        Map<String, Map<String, String>> plan = Windows.plan(spec(), List.of("wtd_sales", "sales", "ytd_sales", "sales_yoy_pct"));
        assertThat(plan.keySet()).containsExactly("ytd", "wtd", "py", "");
        assertThat(plan.get("py")).containsEntry("_py__sales", "sales");
        assertThat(plan.get("")).containsEntry("sales", "sales").containsEntry("_cur__sales", "sales");
    }

    @Test
    void lastYearIsOneRetailYearBackAndLinesUpOnThisYearsDates() {
        Map<String, Object> starts = Map.of("year_start", "2025-12-28", "prev_year_start", "2024-12-29");
        long shift = Windows.pyShiftDays(starts);
        assertThat(shift).isEqualTo(364);
        assertThat(Windows.minusDays("2026-06-01", shift)).isEqualTo("2025-06-02"); // Monday of retail week 23, both years
        List<Map<String, Object>> rows = new ArrayList<>(List.of(new HashMap<>(Map.of("day", java.sql.Date.valueOf("2025-06-02")))));
        Windows.shiftDates(rows, List.of("day"), shift);
        assertThat(rows.get(0).get("day")).isEqualTo(java.sql.Date.valueOf("2026-06-01"));
    }

    @Test
    void yoyTreatsAMissingLastYearAsZeroAndYoyPctAsUnknown() {
        Map<String, Object> row = new HashMap<>();
        row.put("_cur__sales", new java.math.BigDecimal("110"));
        row.put("_py__sales", new java.math.BigDecimal("100"));
        Map<String, Object> noPy = new HashMap<>();
        noPy.put("_cur__sales", new java.math.BigDecimal("50"));
        List<Map<String, Object>> rows = new ArrayList<>(List.of(row, noPy));
        Windows.derive(spec(), List.of("sales_yoy", "sales_yoy_pct"), rows);
        assertThat(((java.math.BigDecimal) row.get("sales_yoy")).intValue()).isEqualTo(10);
        assertThat(((java.math.BigDecimal) row.get("sales_yoy_pct")).doubleValue()).isEqualTo(0.1);
        assertThat(((java.math.BigDecimal) noPy.get("sales_yoy")).intValue()).isEqualTo(50);
        assertThat(noPy.get("sales_yoy_pct")).isNull();
        assertThat(row.keySet()).doesNotContain("_cur__sales", "_py__sales");
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
