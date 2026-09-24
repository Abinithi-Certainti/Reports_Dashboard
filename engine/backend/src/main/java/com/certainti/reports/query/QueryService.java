package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        SqlBuilder.Built built = SqlBuilder.build(spec, request);
        List<Map<String, Object>> rows = jdbc.queryForList(built.sql(), built.params().toArray());
        List<Map<String, Object>> mutable = rows.stream().map(r -> (Map<String, Object>) new LinkedHashMap<>(r)).toList();
        applyCalculations(spec, request, mutable);
        return mutable;
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
        spec.measures().values().forEach(m -> measures.append(measures.isEmpty() ? "" : ", ").append("(").append(m.sql()).append(")"));
        jdbc.queryForList("WITH d AS (\n" + spec.datasetSql() + "\n)\nSELECT " + measures + " FROM (SELECT * FROM d LIMIT 0) d");
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
