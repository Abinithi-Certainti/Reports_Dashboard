package com.certainti.reports.spec;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What the browser is allowed to see of a report: labels, filters and visuals. No SQL. */
public record PublicSpec(
        String id,
        String title,
        String subtitle,
        String sampleDataNotice,
        Map<String, PublicDimension> dimensions,
        Map<String, PublicMeasure> measures,
        Map<String, ReportSpec.Calculation> calculations,
        List<ReportSpec.Filter> filters,
        List<ReportSpec.Visual> visuals) {

    public record PublicDimension(String label, String type) {
    }

    public record PublicMeasure(String label, String format) {
    }

    /** @param sampleDataNotice set only when the engine runs on sample data (a demo); empty in real use */
    public static PublicSpec of(ReportSpec spec, String sampleDataNotice) {
        Map<String, PublicDimension> dims = new LinkedHashMap<>();
        spec.dimensions().forEach((id, d) -> dims.put(id, new PublicDimension(d.label(), d.type())));
        Map<String, PublicMeasure> measures = new LinkedHashMap<>();
        spec.measures().forEach((id, m) -> measures.put(id, new PublicMeasure(m.label(), m.format())));
        String notice = sampleDataNotice == null || sampleDataNotice.isBlank() ? spec.sampleDataNotice() : sampleDataNotice;
        return new PublicSpec(spec.id(), spec.title(), spec.subtitle(), notice, dims, measures,
                spec.calculations() == null ? Map.of() : spec.calculations(),
                spec.filters(), spec.visuals());
    }
}
