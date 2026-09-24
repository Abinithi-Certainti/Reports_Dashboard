package com.certainti.reports.query;

import java.util.List;
import java.util.Map;

/**
 * What the browser asks for. Only names from the report spec are accepted; filter values are bound as parameters.
 *
 * @param filters      dimension id -> selected values (empty or missing means "All")
 * @param exclude      dimension id -> values to leave out
 * @param dateFrom     inclusive, ISO date, applied to the report's date dimension
 * @param dateTo       inclusive, ISO date
 * @param groupBy      dimension ids to group by (empty = one total row)
 * @param measures     measure ids to return
 * @param calculations calculation id -> chosen mode (for example pct_to_total -> legacy)
 */
public record QueryRequest(
        Map<String, List<String>> filters,
        Map<String, List<String>> exclude,
        String dateFrom,
        String dateTo,
        List<String> groupBy,
        List<String> measures,
        Map<String, String> calculations) {

    public Map<String, List<String>> filtersOrEmpty() {
        return filters == null ? Map.of() : filters;
    }

    public Map<String, List<String>> excludeOrEmpty() {
        return exclude == null ? Map.of() : exclude;
    }

    public List<String> groupByOrEmpty() {
        return groupBy == null ? List.of() : groupBy;
    }

    public List<String> measuresOrEmpty() {
        return measures == null ? List.of() : measures;
    }

    public Map<String, String> calculationsOrEmpty() {
        return calculations == null ? Map.of() : calculations;
    }
}
