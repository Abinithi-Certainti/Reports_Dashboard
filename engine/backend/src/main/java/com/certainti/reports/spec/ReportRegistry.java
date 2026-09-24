package com.certainti.reports.spec;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Loads every reports/&lt;id&gt;/report.yaml at start-up and checks it, so a broken spec fails the start rather
 * than a user's page.
 */
@Component
public class ReportRegistry {

    private static final Pattern IDENTIFIER = Pattern.compile("^[a-z_][a-z0-9_]*$");
    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());

    private final Map<String, ReportSpec> reports = new TreeMap<>();

    public ReportRegistry(@Value("${reports.dir}") String reportsDir) {
        Path root = Path.of(reportsDir);
        try (Stream<Path> dirs = Files.list(root)) {
            dirs.map(d -> d.resolve("report.yaml")).filter(Files::exists).forEach(this::load);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read reports directory " + root.toAbsolutePath(), e);
        }
    }

    public Collection<ReportSpec> all() {
        return reports.values();
    }

    public Optional<ReportSpec> find(String id) {
        return Optional.ofNullable(reports.get(id));
    }

    private void load(Path file) {
        try {
            ReportSpec spec = YAML.readValue(file.toFile(), ReportSpec.class);
            String sql = Files.readString(file.getParent().resolve(spec.dataset())).trim();
            if (sql.endsWith(";")) {
                sql = sql.substring(0, sql.length() - 1);
            }
            spec = spec.withDatasetSql(sql);
            validate(spec, file);
            reports.put(spec.id(), spec);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load report spec " + file, e);
        }
    }

    static void validate(ReportSpec spec, Path file) {
        require(spec.id() != null && spec.dimensions() != null && spec.measures() != null, file, "id, dimensions and measures are required");
        require(!spec.datasetSql().contains(";"), file, "dataset SQL must be a single statement");
        spec.dimensions().forEach((id, d) -> {
            require(IDENTIFIER.matcher(id).matches() && IDENTIFIER.matcher(d.column()).matches(), file, "bad dimension name " + id);
            require(d.sortBy() == null || IDENTIFIER.matcher(d.sortBy()).matches(), file, "bad sort_by on " + id);
        });
        spec.measures().forEach((id, m) -> {
            require(IDENTIFIER.matcher(id).matches(), file, "bad measure name " + id);
            require(m.sql() != null && !m.sql().contains(";"), file, "bad measure sql on " + id);
        });
        if (spec.calculations() != null) {
            spec.calculations().forEach((id, c) -> require(spec.measures().containsKey(c.of()), file,
                    "calculation " + id + " refers to unknown measure " + c.of()));
        }
    }

    private static void require(boolean ok, Path file, String message) {
        if (!ok) {
            throw new IllegalStateException(file + ": " + message);
        }
    }
}
