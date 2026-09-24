package com.certainti.reports.web;

import com.certainti.reports.query.QueryRequest;
import com.certainti.reports.query.QueryService;
import com.certainti.reports.query.SqlBuilder;
import com.certainti.reports.spec.PublicSpec;
import com.certainti.reports.spec.ReportRegistry;
import com.certainti.reports.spec.ReportSpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportRegistry registry;
    private final QueryService queries;
    private final String sampleDataNotice;

    public ReportController(ReportRegistry registry, QueryService queries,
                            @Value("${reports.sample-data-notice:}") String sampleDataNotice) {
        this.registry = registry;
        this.queries = queries;
        this.sampleDataNotice = sampleDataNotice;
    }

    public record ReportSummary(String id, String title, String subtitle, boolean imported, int visuals) {
    }

    @GetMapping
    public List<ReportSummary> list() {
        return registry.all().stream().map(s -> new ReportSummary(s.id(), s.title(), s.subtitle(), !registry.isBuiltIn(s.id()),
                s.visuals() == null ? 0 : s.visuals().size())).toList();
    }

    @GetMapping("/{id}")
    public PublicSpec spec(@PathVariable String id) {
        return PublicSpec.of(report(id), sampleDataNotice);
    }

    @GetMapping("/{id}/values/{dimension}")
    public List<Object> values(@PathVariable String id, @PathVariable String dimension) {
        return queries.distinctValues(report(id), dimension);
    }

    @GetMapping("/{id}/date-bounds")
    public Map<String, Object> dateBounds(@PathVariable String id) {
        return queries.dateBounds(report(id));
    }

    /** Old -> new field mapping for a report, exported from the catalog (tools/export_mapping.sh). */
    @GetMapping(value = "/{id}/mapping", produces = "application/json")
    public String mapping(@PathVariable String id) throws IOException {
        report(id);
        Path file = registry.folderOf(id).map(f -> f.resolve("mapping.json")).filter(Files::exists)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No mapping recorded for " + id));
        return Files.readString(file);
    }

    @PostMapping("/{id}/query")
    public List<Map<String, Object>> query(@PathVariable String id, @RequestBody QueryRequest request) {
        return queries.run(report(id), request);
    }

    @ExceptionHandler(SqlBuilder.BadRequest.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> badRequest(SqlBuilder.BadRequest e) {
        return Map.of("error", e.getMessage());
    }

    private ReportSpec report(String id) {
        return registry.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No report " + id));
    }
}
