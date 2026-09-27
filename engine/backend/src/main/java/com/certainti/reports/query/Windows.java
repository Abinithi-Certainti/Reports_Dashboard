package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Week-, period- and year-to-date measures. Each window is the same query run over its own dates; the results are
 * joined back into one row per group. The widest window runs first so its rows set the order.
 */
final class Windows {

    /** Run order: year, period, week, then measures with no window (they use the selected dates as they are). */
    static final List<String> ORDER = List.of("ytd", "ptd", "wtd", "");

    private Windows() {
    }

    /** The requested measures, grouped by window ("" = no window), in {@link #ORDER}. */
    static Map<String, List<String>> split(ReportSpec spec, List<String> measures) {
        Map<String, List<String>> byWindow = new LinkedHashMap<>();
        ORDER.forEach(w -> byWindow.put(w, new ArrayList<>()));
        for (String id : measures) {
            ReportSpec.Measure m = spec.measures().get(id);
            if (m == null) {
                throw new SqlBuilder.BadRequest("Unknown measure: " + id);
            }
            byWindow.get(m.isWindowed() ? m.window() : "").add(id);
        }
        byWindow.values().removeIf(List::isEmpty);
        return byWindow;
    }

    /** First day of a window. {@code starts} holds week_start, period_start and year_start of the last selected day. */
    static String start(String window, Map<String, Object> starts, String dateFrom) {
        Object day = switch (window) {
            case "wtd" -> starts.get("week_start");
            case "ptd" -> starts.get("period_start");
            case "ytd" -> starts.get("year_start");
            default -> dateFrom;
        };
        return day == null ? null : day.toString();
    }

    /** Joins the per-window results on the group-by values. A group missing from a window gets null there. */
    static List<Map<String, Object>> merge(List<String> groupBy, List<String> measures, List<List<Map<String, Object>>> parts) {
        Map<List<Object>, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (List<Map<String, Object>> part : parts) {
            for (Map<String, Object> row : part) {
                List<Object> key = Arrays.asList(groupBy.stream().map(row::get).toArray());
                Map<String, Object> out = byKey.computeIfAbsent(key, k -> {
                    Map<String, Object> fresh = new LinkedHashMap<>();
                    groupBy.forEach(g -> fresh.put(g, row.get(g)));
                    measures.forEach(m -> fresh.put(m, null));
                    return fresh;
                });
                row.forEach((col, value) -> {
                    if (!groupBy.contains(col)) {
                        out.put(col, value);
                    }
                });
            }
        }
        if (byKey.isEmpty() && groupBy.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            measures.forEach(m -> empty.put(m, null));
            return new ArrayList<>(List.of(empty));
        }
        return new ArrayList<>(byKey.values());
    }
}
