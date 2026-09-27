package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class QueryService {

    private final JdbcTemplate jdbc;

    public QueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> run(ReportSpec spec, QueryRequest request) {
        Map<String, Map<String, String>> plan = Windows.plan(spec, request.measuresOrEmpty());
        List<Map<String, Object>> rows;
        if (!Windows.needsCalendar(plan)) {
            rows = runOnce(spec, request, plan.getOrDefault("", Map.of()));
        } else {
            if (request.dateTo() == null) {
                throw new SqlBuilder.BadRequest("Week, period, year to date and last year need a selected end date");
            }
            SqlBuilder.Built day = SqlBuilder.calendarDay(spec, request.dateTo());
            List<Map<String, Object>> found = jdbc.queryForList(day.sql(), day.params().toArray());
            if (found.isEmpty()) {
                throw new SqlBuilder.BadRequest(request.dateTo() + " is not in the retail calendar");
            }
            Map<String, Object> starts = found.get(0);
            List<String> dateColumns = request.groupByOrEmpty().stream()
                    .filter(g -> spec.dimensions().containsKey(g) && spec.dimensions().get(g).isDate()).toList();
            List<List<Map<String, Object>>> parts = new ArrayList<>();
            List<String> columns = new ArrayList<>();
            plan.forEach((window, cols) -> {
                columns.addAll(cols.keySet());
                String from = Windows.start(window, starts, request.dateFrom());
                String to = request.dateTo();
                long shift = 0;
                if (window.equals("py")) {
                    shift = Windows.pyShiftDays(starts);
                    from = Windows.minusDays(request.dateFrom(), shift);
                    to = Windows.minusDays(to, shift);
                }
                List<Map<String, Object>> part = runOnce(spec, new QueryRequest(request.filters(), request.exclude(),
                        from, to, request.groupBy(), List.copyOf(cols.keySet()), null), cols);
                Windows.shiftDates(part, dateColumns, shift);
                parts.add(part);
            });
            rows = Windows.merge(request.groupByOrEmpty(), columns, parts);
            Windows.derive(spec, request.measuresOrEmpty(), rows);
        }
        applyCalculations(spec, request, rows);
        return rows;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> calendarWeeks(ReportSpec spec) {
        SqlBuilder.Built built = SqlBuilder.calendarWeeks(spec);
        return jdbc.queryForList(built.sql());
    }

    private List<Map<String, Object>> runOnce(ReportSpec spec, QueryRequest request, Map<String, String> columns) {
        SqlBuilder.Built built = SqlBuilder.build(spec, request, columns);
        List<Map<String, Object>> rows = jdbc.queryForList(built.sql(), built.params().toArray());
        return new ArrayList<>(rows.stream().map(r -> (Map<String, Object>) new LinkedHashMap<>(r)).toList());
    }

    @Transactional(readOnly = true)
    public List<Object> distinctValues(ReportSpec spec, String dimension) {
        SqlBuilder.Built built = SqlBuilder.distinctValues(spec, dimension);
        return jdbc.queryForList(built.sql(), Object.class);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dateBounds(ReportSpec spec) {
        SqlBuilder.Built built = SqlBuilder.dateBounds(spec);
        return jdbc.queryForMap(built.sql());
    }

    /**
     * Proves an uploaded spec works without reading any rows: every dimension column and every measure is
     * evaluated over the dataset with LIMIT 0, inside a read-only transaction.
     */
    @Transactional(readOnly = true)
    public void dryRun(ReportSpec spec) {
        StringBuilder select = new StringBuilder();
        spec.dimensions().values().forEach(d -> select.append(select.isEmpty() ? "" : ", ").append("d.").append(d.column()));
        jdbc.queryForList("WITH d AS (\n" + spec.datasetSql() + "\n)\nSELECT " + select + " FROM d LIMIT 0");
        StringBuilder measures = new StringBuilder();
        spec.measures().forEach((id, m) -> {
            if (!m.isWindowed()) {
                measures.append(measures.isEmpty() ? "" : ", ").append("(").append(m.sql()).append(")");
            }
        });
        jdbc.queryForList("WITH d AS (\n" + spec.datasetSql() + "\n)\nSELECT " + measures + " FROM (SELECT * FROM d LIMIT 0) d");
        if (spec.calendarSql() != null) {
            jdbc.queryForList("WITH c AS (\n" + spec.calendarSql() + "\n)\nSELECT day, retail_year, retail_period, retail_week,"
                    + " week_start, week_end, period_start, year_start FROM c LIMIT 0");
        }
    }

    private static void applyCalculations(ReportSpec spec, QueryRequest request, List<Map<String, Object>> rows) {
        request.calculationsOrEmpty().forEach((calcId, modeId) -> {
            ReportSpec.Calculation calc = spec.calculations() == null ? null : spec.calculations().get(calcId);
            if (calc == null) {
                throw new SqlBuilder.BadRequest("Unknown calculation: " + calcId);
            }
            String mode = modeId != null ? modeId : calc.defaultMode();
            ReportSpec.Mode m = calc.modes().get(mode);
            if (m == null) {
                throw new SqlBuilder.BadRequest("Unknown mode " + mode + " for " + calcId);
            }
            if (!request.measuresOrEmpty().contains(calc.of())) {
                throw new SqlBuilder.BadRequest(calcId + " needs measure " + calc.of() + " in the request");
            }
            Calculations.apply(m.type(), calcId, calc.of(), rows);
        });
    }
}
