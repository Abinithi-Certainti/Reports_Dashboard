package com.certainti.reports.query;

import com.certainti.reports.spec.ReportSpec;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Measures over other dates than the selected ones.
 * <ul>
 *   <li>wtd / ptd / ytd: from the start of the retail week, period or year that holds the last selected day.</li>
 *   <li>mtd: from the 1st of the calendar month that holds the last selected day.</li>
 *   <li>py: the selected days one retail year earlier - the same weekday of the same retail week, like the old
 *   reports' DWY - 1. Rows grouped by a date come back on this year's dates, so they line up with this year.</li>
 *   <li>yoy = value - py (a missing py counts as 0, like Power BI), yoy_pct = (value - py) / py.</li>
 *   <li>py_fin: the selected days on the same calendar dates one year earlier (the old reports' YMD - 10000);
 *   yoy_fin / yoy_fin_pct work like yoy / yoy_pct against py_fin.</li>
 * </ul>
 * Each window is the same query run over its own dates; the results are joined back into one row per group.
 * The widest window runs first so its rows set the order.
 */
final class Windows {

    /** Run order: year, period, month, week, last year (retail, then calendar), then the selected dates as they are (""). */
    static final List<String> ORDER = List.of("ytd", "ptd", "mtd", "wtd", "py", "py_fin", "");

    private Windows() {
    }

    /**
     * What to run: window -> (column alias -> measure whose SQL it uses). yoy and yoy_pct need their base measure on
     * the selected dates and one year earlier; those land in helper columns (_cur__x, _py__x) that {@link #derive}
     * turns into the requested value and removes.
     */
    static Map<String, Map<String, String>> plan(ReportSpec spec, List<String> measures) {
        Map<String, Map<String, String>> plan = new LinkedHashMap<>();
        ORDER.forEach(w -> plan.put(w, new LinkedHashMap<>()));
        for (String id : measures) {
            ReportSpec.Measure m = spec.measures().get(id);
            if (m == null) {
                throw new SqlBuilder.BadRequest("Unknown measure: " + id);
            }
            String window = m.window() == null ? "" : m.window();
            if (window.equals("yoy") || window.equals("yoy_pct")) {
                plan.get("").put("_cur__" + m.of(), m.of());
                plan.get("py").put("_py__" + m.of(), m.of());
            } else if (window.equals("yoy_fin") || window.equals("yoy_fin_pct")) {
                plan.get("").put("_cur__" + m.of(), m.of());
                plan.get("py_fin").put("_pyfin__" + m.of(), m.of());
            } else {
                plan.get(window).put(id, id);
            }
        }
        plan.values().removeIf(Map::isEmpty);
        return plan;
    }

    static boolean needsCalendar(Map<String, Map<String, String>> plan) {
        return plan.keySet().stream().anyMatch(w -> !w.isEmpty());
    }

    /** First day of a window. {@code starts} holds week_start, period_start and year_start of the last selected day. */
    static String start(String window, Map<String, Object> starts, String dateFrom) {
        Object day = switch (window) {
            case "wtd" -> starts.get("week_start");
            case "ptd" -> starts.get("period_start");
            case "ytd" -> starts.get("year_start");
            case "mtd" -> monthStart(dateFrom, starts);
            default -> dateFrom;
        };
        return day == null ? null : day.toString();
    }

    private static String monthStart(String dateFrom, Map<String, Object> starts) {
        Object last = starts.get("day");
        return last == null ? dateFrom : LocalDate.parse(last.toString()).withDayOfMonth(1).toString();
    }

    static String minusYear(String day) {
        return day == null ? null : LocalDate.parse(day).minusYears(1).toString();
    }

    /** Moves last year's calendar-date rows onto this year's dates. */
    static void shiftYear(List<Map<String, Object>> rows, List<String> dateColumns) {
        for (Map<String, Object> row : rows) {
            for (String col : dateColumns) {
                Object v = row.get(col);
                if (v != null) {
                    LocalDate moved = LocalDate.parse(v.toString()).plusYears(1);
                    row.put(col, v instanceof java.sql.Date ? java.sql.Date.valueOf(moved) : moved.toString());
                }
            }
        }
    }

    /** Days between this retail year's start and last retail year's start (364, or 371 after a 53-week year). */
    static long pyShiftDays(Map<String, Object> starts) {
        Object year = starts.get("year_start");
        Object previous = starts.get("prev_year_start");
        if (year == null || previous == null) {
            throw new SqlBuilder.BadRequest("Last year's retail calendar is missing, so PY cannot be worked out");
        }
        return LocalDate.parse(year.toString()).toEpochDay() - LocalDate.parse(previous.toString()).toEpochDay();
    }

    static String minusDays(String day, long days) {
        return day == null ? null : LocalDate.parse(day).minusDays(days).toString();
    }

    /** Moves last year's rows onto this year's dates, so they join with this year's rows. */
    static void shiftDates(List<Map<String, Object>> rows, List<String> dateColumns, long days) {
        for (Map<String, Object> row : rows) {
            for (String col : dateColumns) {
                Object v = row.get(col);
                if (v != null) {
                    LocalDate moved = LocalDate.parse(v.toString()).plusDays(days);
                    row.put(col, v instanceof java.sql.Date ? java.sql.Date.valueOf(moved) : moved.toString());
                }
            }
        }
    }

    /** Joins the per-window results on the group-by values. A group missing from a window gets null there. */
    static List<Map<String, Object>> merge(List<String> groupBy, List<String> columns, List<List<Map<String, Object>>> parts) {
        Map<List<Object>, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (List<Map<String, Object>> part : parts) {
            for (Map<String, Object> row : part) {
                List<Object> key = Arrays.asList(groupBy.stream().map(row::get).toArray());
                Map<String, Object> out = byKey.computeIfAbsent(key, k -> {
                    Map<String, Object> fresh = new LinkedHashMap<>();
                    groupBy.forEach(g -> fresh.put(g, row.get(g)));
                    columns.forEach(m -> fresh.put(m, null));
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
            columns.forEach(m -> empty.put(m, null));
            return new ArrayList<>(List.of(empty));
        }
        return new ArrayList<>(byKey.values());
    }

    /** Works out yoy / yoy_pct from the helper columns, then drops the helpers. */
    static void derive(ReportSpec spec, List<String> measures, List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            for (String id : measures) {
                ReportSpec.Measure m = spec.measures().get(id);
                String w = m.window();
                if (w == null || !(w.equals("yoy") || w.equals("yoy_pct") || w.equals("yoy_fin") || w.equals("yoy_fin_pct"))) {
                    continue;
                }
                BigDecimal cur = number(row.get("_cur__" + m.of()));
                BigDecimal py = number(row.get((w.startsWith("yoy_fin") ? "_pyfin__" : "_py__") + m.of()));
                if (w.equals("yoy") || w.equals("yoy_fin")) {
                    row.put(id, cur == null && py == null ? null
                            : (cur == null ? BigDecimal.ZERO : cur).subtract(py == null ? BigDecimal.ZERO : py));
                } else {
                    row.put(id, cur == null || py == null || py.signum() == 0 ? null
                            : cur.subtract(py).divide(py, 10, java.math.RoundingMode.HALF_EVEN));
                }
            }
            row.keySet().removeIf(k -> k.startsWith("_cur__") || k.startsWith("_py__") || k.startsWith("_pyfin__"));
        }
    }

    private static BigDecimal number(Object v) {
        if (v == null) {
            return null;
        }
        return v instanceof BigDecimal b ? b : new BigDecimal(v.toString());
    }
}
