package com.certainti.reports.web;

import com.certainti.reports.query.QueryService;
import com.certainti.reports.spec.ReportRegistry;
import com.certainti.reports.spec.ReportSpec;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

/**
 * Adds a report by uploading its two files (report.yaml + dataset.sql) - no code change, no redeploy.
 * Every upload goes through the same checks; "validate" runs them without saving, "publish" saves and goes live.
 *
 * NOTE: there is no login yet. Before this runs anywhere shared, these endpoints must be limited to admins.
 */
@RestController
@RequestMapping("/api/admin/reports")
public class ImportController {

    private final ReportRegistry registry;
    private final QueryService queries;

    public ImportController(ReportRegistry registry, QueryService queries) {
        this.registry = registry;
        this.queries = queries;
    }

    public record Upload(String yaml, String sql) {
    }

    public record Check(String name, boolean ok, String detail) {
    }

    public record Result(boolean ok, String id, String title, List<Check> checks) {
    }

    @PostMapping("/validate")
    public Result validate(@RequestBody Upload upload) {
        return run(upload, false);
    }

    @PostMapping
    public ResponseEntity<Result> publish(@RequestBody Upload upload) {
        Result r = run(upload, true);
        return ResponseEntity.status(r.ok() ? HttpStatus.CREATED : HttpStatus.UNPROCESSABLE_ENTITY).body(r);
    }

    private Result run(Upload upload, boolean publish) {
        List<Check> checks = new ArrayList<>();
        ReportSpec spec;
        try {
            spec = registry.parse(upload.yaml(), upload.sql());
            checks.add(new Check("Settings file is valid", true,
                    spec.dimensions().size() + " fields, " + spec.measures().size() + " measures, "
                            + (spec.visuals() == null ? 0 : spec.visuals().size()) + " visuals"));
            checks.add(new Check("SQL only reads data", true, "single SELECT statement"));
        } catch (IllegalArgumentException e) {
            checks.add(new Check("Settings file is valid", false, e.getMessage()));
            return new Result(false, null, null, checks);
        }
        if (registry.find(spec.id()).isPresent() && registry.isBuiltIn(spec.id())) {
            checks.add(new Check("Report id is free", false, "'" + spec.id() + "' is a built-in report and cannot be replaced by an upload"));
            return new Result(false, spec.id(), spec.title(), checks);
        }
        checks.add(new Check("Report id is free", true, registry.find(spec.id()).isPresent() ? "replaces the earlier upload" : spec.id()));
        try {
            queries.dryRun(spec);
            checks.add(new Check("Runs on the database", true, "every field and measure checked (read-only, no rows read)"));
        } catch (RuntimeException e) {
            Throwable root = e;
            while (root.getCause() != null) root = root.getCause();
            checks.add(new Check("Runs on the database", false, root.getMessage()));
            return new Result(false, spec.id(), spec.title(), checks);
        }
        if (publish) {
            registry.publish(spec, upload.yaml(), upload.sql());
            checks.add(new Check("Published", true, "live now at #/r/" + spec.id()));
        }
        return new Result(true, spec.id(), spec.title(), checks);
    }
}
