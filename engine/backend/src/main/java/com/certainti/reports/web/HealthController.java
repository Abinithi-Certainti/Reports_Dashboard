package com.certainti.reports.web;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * GET /api/health: {"database": "up"} when a SELECT 1 succeeds within a few seconds, else HTTP 503 {"database": "down"}.
 * The frontend calls it once at start-up to pick its data source: live DEV data, or the in-browser copy.
 * Read-only: it runs nothing but SELECT 1. The pool can wait up to 30 s for a connection, so the check runs on its own
 * thread and gives up after the timeout; a check still waiting is reused rather than started again.
 */
@RestController
public class HealthController {

    private static final Map<String, String> UP = Map.of("database", "up");
    private static final Map<String, String> DOWN = Map.of("database", "down");

    private final DataSource dataSource;
    private final Duration timeout;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "db-health");
        t.setDaemon(true);
        return t;
    });
    private Future<Boolean> inFlight;

    @Autowired
    public HealthController(DataSource dataSource) {
        this(dataSource, Duration.ofSeconds(3));
    }

    HealthController(DataSource dataSource, Duration timeout) {
        this.dataSource = dataSource;
        this.timeout = timeout;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        return databaseUp() ? ResponseEntity.ok(UP) : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DOWN);
    }

    boolean databaseUp() {
        Future<Boolean> check;
        synchronized (this) {
            if (inFlight == null || inFlight.isDone()) inFlight = worker.submit(this::selectOne);
            check = inFlight;
        }
        try {
            return check.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            return false; // timed out or failed
        }
    }

    private boolean selectOne() {
        try (Connection c = dataSource.getConnection(); Statement s = c.createStatement()) {
            s.setQueryTimeout((int) Math.max(1, timeout.toSeconds()));
            try (ResultSet r = s.executeQuery("SELECT 1")) {
                return r.next() && r.getInt(1) == 1;
            }
        } catch (SQLException e) {
            return false;
        }
    }
}
