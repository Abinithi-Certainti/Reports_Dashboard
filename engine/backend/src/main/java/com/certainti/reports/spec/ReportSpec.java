package com.certainti.reports.spec;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * One report, read from reports/&lt;id&gt;/report.yaml. The dataset SQL is loaded from the file named in
 * {@code dataset}. Neither the dataset SQL nor measure SQL is ever sent to the browser: see {@link PublicSpec}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ReportSpec(
        String id,
        String title,
        String subtitle,
        String dataset,
        @JsonProperty("sample_data_notice") String sampleDataNotice,
        Map<String, Dimension> dimensions,
        Map<String, Measure> measures,
        Map<String, Calculation> calculations,
        List<Filter> filters,
        List<Visual> visuals,
        String calendar,
        String datasetSql,
        String calendarSql) {

    /** The only calendar so far: the retail calendar (Sunday-Saturday weeks, 4-4-5 periods), from reports/_shared. */
    public static final String RETAIL_CALENDAR = "retail";

    public ReportSpec withDatasetSql(String sql) {
        return new ReportSpec(id, title, subtitle, dataset, sampleDataNotice, dimensions, measures, calculations,
                filters, visuals, calendar, sql, calendarSql);
    }

    public ReportSpec withCalendarSql(String sql) {
        return new ReportSpec(id, title, subtitle, dataset, sampleDataNotice, dimensions, measures, calculations,
                filters, visuals, calendar, datasetSql, sql);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Dimension(String label, String column, String type, @JsonProperty("sort_by") String sortBy) {
        public boolean isDate() {
            return "date".equals(type);
        }
    }

    /**
     * A measure is either its own {@code sql}, or another measure ({@code of}) over a retail-calendar {@code window}:
     * wtd / ptd / ytd = from the start of the retail week, period or year that holds the last selected day,
     * py = the selected days one retail year earlier, yoy = value - py, yoy_pct = (value - py) / py.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Measure(String label, String sql, String format, String window, String of) {
        public Measure(String label, String sql, String format) {
            this(label, sql, format, null, null);
        }

        public boolean isWindowed() {
            return window != null;
        }
    }

    /** A value worked out after the query, from the returned rows (for example a share of the total). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Calculation(String label, String of, String format, Map<String, Mode> modes,
                              @JsonProperty("default_mode") String defaultMode) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Mode(String type, String label) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    /** {@code open_on}: a date filter opens on the latest day where this dataset column is not 0 (default: the latest day). */
    public record Filter(String dimension, String type, @JsonProperty("default_last_days") Integer defaultLastDays,
                         @JsonProperty("open_on") String openOn) {
    }

    /**
     * One block on the page. {@code span} is its width on a 12-column grid (default per type); {@code limit} caps a
     * leaderboard's rows.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Visual(String type, String title, List<String> rows, List<String> columns, List<String> values,
                         List<KpiItem> items, @JsonProperty("total_row") Boolean totalRow, Integer span, Integer limit,
                         List<String> highlight, List<String> signs, String total) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KpiItem(String label, String measure, Map<String, List<String>> include,
                          Map<String, List<String>> exclude,
                          @JsonProperty("good_direction") String goodDirection, String icon) {
    }
}
