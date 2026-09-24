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
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Holds every report the engine can show.
 * <ul>
 *   <li>Built-in reports: reports/&lt;id&gt;/report.yaml, loaded at start-up.</li>
 *   <li>Imported reports: uploaded in the browser (see ImportController), saved under the import folder so they
 *   survive a restart, and live immediately - no code change, no redeploy.</li>
 * </ul>
 * A broken spec fails its own load and never reaches a user's page.
 */
@Component
public class ReportRegistry {

    private static final Pattern IDENTIFIER = Pattern.compile("^[a-z_][a-z0-9_]*$");
    private static final Pattern REPORT_ID = Pattern.compile("^[a-z0-9][a-z0-9-]{1,60}$");
    private static final Pattern STARTS_WITH_SELECT = Pattern.compile("^\\s*(--[^\\n]*\\n\\s*|/\\*.*?\\*/\\s*)*(select|with)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    static final java.util.Set<String> VISUAL_TYPES = java.util.Set.of("kpi", "line", "table", "bar", "matrix", "donut", "leaderboard");
    static final java.util.Set<String> KPI_ICONS = java.util.Set.of("total", "cash", "card", "paidout", "count", "store", "trend");
    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());

    private final Map<String, ReportSpec> reports = new ConcurrentSkipListMap<>();
    private final Map<String, Path> folders = new ConcurrentSkipListMap<>();
    private final Path importDir;

    public ReportRegistry(@Value("${reports.dir}") String reportsDir,
                          @Value("${reports.import-dir}") String importDir) {
        this.importDir = Path.of(importDir);
        loadAll(Path.of(reportsDir), false);
        loadAll(this.importDir, true);
    }

    public Collection<ReportSpec> all() {
        return reports.values();
    }

    public Optional<ReportSpec> find(String id) {
        return Optional.ofNullable(reports.get(id));
    }

    /** The folder a report was loaded from (for its optional mapping.json). */
    public Optional<Path> folderOf(String id) {
        return Optional.ofNullable(folders.get(id));
    }

    /** Parses and checks an uploaded spec without saving it. Throws IllegalArgumentException with a plain message. */
    public ReportSpec parse(String yaml, String datasetSql) {
        ReportSpec spec;
        try {
            spec = YAML.readValue(yaml, ReportSpec.class);
        } catch (IOException e) {
            String msg = e instanceof com.fasterxml.jackson.core.JsonProcessingException j ? j.getOriginalMessage() : e.getMessage();
            throw new IllegalArgumentException("report.yaml is not valid YAML: " + msg);
        }
        spec = spec.withDatasetSql(cleanSql(datasetSql));
        try {
            validate(spec, Path.of("upload"));
        } catch (IllegalStateException e) {
            throw new IllegalArgumentException(e.getMessage().replace("upload: ", ""));
        }
        return spec;
    }

    /** Saves an imported report under the import folder and makes it live. */
    public synchronized void publish(ReportSpec spec, String yaml, String datasetSql) {
        Path folder = importDir.resolve(spec.id());
        try {
            Files.createDirectories(folder);
            Files.writeString(folder.resolve("report.yaml"), yaml);
            Files.writeString(folder.resolve("dataset.sql"), datasetSql);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot save imported report " + spec.id(), e);
        }
        reports.put(spec.id(), spec);
        folders.put(spec.id(), folder);
    }

    public boolean isBuiltIn(String id) {
        Path folder = folders.get(id);
        return folder != null && !folder.startsWith(importDir);
    }

    private void loadAll(Path root, boolean optional) {
        if (optional && !Files.isDirectory(root)) {
            return;
        }
        try (Stream<Path> dirs = Files.list(root)) {
            dirs.map(d -> d.resolve("report.yaml")).filter(Files::exists).sorted().forEach(this::load);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read reports directory " + root.toAbsolutePath(), e);
        }
    }

    private void load(Path file) {
        try {
            ReportSpec spec = YAML.readValue(file.toFile(), ReportSpec.class);
            spec = spec.withDatasetSql(cleanSql(Files.readString(file.getParent().resolve(spec.dataset()))));
            validate(spec, file);
            reports.put(spec.id(), spec);
            folders.put(spec.id(), file.getParent());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load report spec " + file, e);
        }
    }

    private static String cleanSql(String sql) {
        String s = sql == null ? "" : sql.trim();
        return s.endsWith(";") ? s.substring(0, s.length() - 1).trim() : s;
    }

    static void validate(ReportSpec spec, Path file) {
        require(spec.id() != null && REPORT_ID.matcher(spec.id()).matches(), file,
                "id must be lower-case letters, digits and dashes, e.g. paidout-report");
        require(spec.title() != null && !spec.title().isBlank(), file, "title is required");
        require(spec.dimensions() != null && !spec.dimensions().isEmpty(), file, "at least one dimension is required");
        require(spec.measures() != null && !spec.measures().isEmpty(), file, "at least one measure is required");
        require(!spec.datasetSql().isEmpty(), file, "dataset SQL is empty");
        require(!spec.datasetSql().contains(";"), file, "dataset SQL must be a single statement (no semicolons)");
        require(STARTS_WITH_SELECT.matcher(spec.datasetSql()).find(), file, "dataset SQL must be a SELECT (or WITH ... SELECT)");
        String lower = spec.datasetSql().toLowerCase(Locale.ROOT);
        for (String word : new String[]{"insert ", "update ", "delete ", "drop ", "alter ", "truncate ", "grant ", "create "}) {
            require(!lower.contains(word), file, "dataset SQL must only read data (found '" + word.trim() + "')");
        }
        spec.dimensions().forEach((id, d) -> {
            require(IDENTIFIER.matcher(id).matches() && d.column() != null && IDENTIFIER.matcher(d.column()).matches(), file,
                    "bad dimension name " + id);
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
        if (spec.visuals() != null) {
            for (ReportSpec.Visual v : spec.visuals()) {
                require(v.type() != null && VISUAL_TYPES.contains(v.type()), file,
                        "visual type must be one of " + String.join(", ", new java.util.TreeSet<>(VISUAL_TYPES)) + " (found " + v.type() + ")");
                require(v.span() == null || (v.span() >= 1 && v.span() <= 12), file, "visual '" + v.title() + "' span must be 1 to 12");
                require(v.limit() == null || (v.limit() >= 1 && v.limit() <= 50), file, "visual '" + v.title() + "' limit must be 1 to 50");
                for (String d : concat(v.rows(), v.columns())) {
                    require(spec.dimensions().containsKey(d), file, "visual '" + v.title() + "' uses unknown dimension " + d);
                }
                if (v.values() != null) {
                    for (String val : v.values()) {
                        require(spec.measures().containsKey(val) || (spec.calculations() != null && spec.calculations().containsKey(val)),
                                file, "visual '" + v.title() + "' uses unknown value " + val);
                    }
                }
                if (v.items() != null) {
                    v.items().forEach(i -> {
                        require(spec.measures().containsKey(i.measure()), file, "KPI '" + i.label() + "' uses unknown measure " + i.measure());
                        require(i.icon() == null || KPI_ICONS.contains(i.icon()), file,
                                "KPI '" + i.label() + "' icon must be one of " + String.join(", ", new java.util.TreeSet<>(KPI_ICONS)));
                    });
                }
            }
        }
    }

    private static java.util.List<String> concat(java.util.List<String> a, java.util.List<String> b) {
        java.util.List<String> out = new java.util.ArrayList<>();
        if (a != null) out.addAll(a);
        if (b != null) out.addAll(b);
        return out;
    }

    private static void require(boolean ok, Path file, String message) {
        if (!ok) {
            throw new IllegalStateException(file + ": " + message);
        }
    }
}
