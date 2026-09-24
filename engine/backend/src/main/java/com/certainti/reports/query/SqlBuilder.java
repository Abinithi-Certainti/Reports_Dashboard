package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;
import com.certainti.reports.spec.ReportSpec.Dimension;
import com.certainti.reports.spec.ReportSpec.Measure;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Turns a {@link QueryRequest} into one parameterised SQL statement over the report's dataset:
 * <pre>
 * WITH d AS (&lt;dataset sql&gt;)
 * SELECT &lt;dimensions&gt;, &lt;measures&gt; FROM d WHERE &lt;filters&gt; GROUP BY ... ORDER BY ...
 * </pre>
 * Every name comes from the spec (checked at load time); every value is a bind parameter.
 */
public final class SqlBuilder {

    public record Built(String sql, List<Object> params) {
    }

    private SqlBuilder() {
    }

    public static Built build(ReportSpec spec, QueryRequest request) {
        List<Object> params = new ArrayList<>();
        StringJoiner select = new StringJoiner(", ");
        StringJoiner groupBy = new StringJoiner(", ");
        StringJoiner orderBy = new StringJoiner(", ");

        for (String dimId : request.groupByOrEmpty()) {
            Dimension dim = dimension(spec, dimId);
            select.add("d." + dim.column() + " AS " + dimId);
            groupBy.add("d." + dim.column());
            // Sort column first (for example payment type order), then the value itself, so ties are A to Z.
            if (dim.sortBy() != null) {
                orderBy.add("min(d." + dim.sortBy() + ") NULLS LAST");
            }
            orderBy.add("d." + dim.column() + " NULLS LAST");
        }
        if (request.measuresOrEmpty().isEmpty()) {
            throw new BadRequest("At least one measure is required");
        }
        for (String measureId : request.measuresOrEmpty()) {
            Measure measure = spec.measures().get(measureId);
            if (measure == null) {
                throw new BadRequest("Unknown measure: " + measureId);
            }
            select.add("(" + measure.sql() + ") AS " + measureId);
        }

        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        addValueFilters(spec, request.filtersOrEmpty(), where, params, false);
        addValueFilters(spec, request.excludeOrEmpty(), where, params, true);
        Dimension dateDim = dateDimension(spec);
        if (request.dateFrom() != null) {
            where.append(" AND d.").append(requireDate(dateDim).column()).append(" >= ?");
            params.add(parseDate(request.dateFrom()));
        }
        if (request.dateTo() != null) {
            where.append(" AND d.").append(requireDate(dateDim).column()).append(" <= ?");
            params.add(parseDate(request.dateTo()));
        }

        StringBuilder sql = new StringBuilder("WITH d AS (\n").append(spec.datasetSql()).append("\n)\nSELECT ")
                .append(select).append(" FROM d").append(where);
        if (groupBy.length() > 0) {
            sql.append(" GROUP BY ").append(groupBy).append(" ORDER BY ").append(orderBy);
        }
        return new Built(sql.toString(), params);
    }

    /** Distinct values of one dimension, for a filter dropdown. */
    public static Built distinctValues(ReportSpec spec, String dimId) {
        Dimension dim = dimension(spec, dimId);
        String order = (dim.sortBy() != null ? "min(d." + dim.sortBy() + "), " : "") + "d." + dim.column();
        String sql = "WITH d AS (\n" + spec.datasetSql() + "\n)\nSELECT d." + dim.column() + " AS value FROM d"
                + " WHERE d." + dim.column() + " IS NOT NULL GROUP BY d." + dim.column() + " ORDER BY " + order;
        return new Built(sql, List.of());
    }

    /** Earliest and latest date in the dataset, for the date filter. */
    public static Built dateBounds(ReportSpec spec) {
        Dimension dim = requireDate(dateDimension(spec));
        String sql = "WITH d AS (\n" + spec.datasetSql() + "\n)\nSELECT min(d." + dim.column() + ") AS min_date, max(d."
                + dim.column() + ") AS max_date FROM d";
        return new Built(sql, List.of());
    }

    private static void addValueFilters(ReportSpec spec, Map<String, List<String>> filters, StringBuilder where,
                                        List<Object> params, boolean exclude) {
        for (Map.Entry<String, List<String>> f : filters.entrySet()) {
            if (f.getValue() == null || f.getValue().isEmpty()) {
                continue;
            }
            Dimension dim = dimension(spec, f.getKey());
            if (dim.isDate()) {
                throw new BadRequest("Use dateFrom/dateTo for " + f.getKey());
            }
            String column = "d." + dim.column();
            where.append(exclude
                    ? " AND (" + column + " IS NULL OR NOT (" + column + "::text = ANY (?)))"
                    : " AND " + column + "::text = ANY (?)");
            params.add(f.getValue().toArray(String[]::new));
        }
    }

    private static Dimension dimension(ReportSpec spec, String id) {
        Dimension dim = spec.dimensions().get(id);
        if (dim == null) {
            throw new BadRequest("Unknown dimension: " + id);
        }
        return dim;
    }

    private static Dimension dateDimension(ReportSpec spec) {
        return spec.dimensions().values().stream().filter(Dimension::isDate).findFirst().orElse(null);
    }

    private static Dimension requireDate(Dimension dim) {
        if (dim == null) {
            throw new BadRequest("This report has no date dimension");
        }
        return dim;
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException e) {
            throw new BadRequest("Bad date: " + value);
        }
    }

    public static class BadRequest extends RuntimeException {
        public BadRequest(String message) {
            super(message);
        }
    }
}
