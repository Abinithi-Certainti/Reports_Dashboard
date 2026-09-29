package com.certainti.reports.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HealthControllerTest {

    @Test
    void upWhenSelectOneWorks() throws SQLException {
        DataSource ds = mock(DataSource.class);
        Connection c = mock(Connection.class);
        Statement s = mock(Statement.class);
        ResultSet r = mock(ResultSet.class);
        when(ds.getConnection()).thenReturn(c);
        when(c.createStatement()).thenReturn(s);
        when(s.executeQuery(anyString())).thenReturn(r);
        when(r.next()).thenReturn(true);
        when(r.getInt(1)).thenReturn(1);

        ResponseEntity<Map<String, String>> res = new HealthController(ds, Duration.ofSeconds(2)).health();
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("database", "up");
    }

    @Test
    void downWhenNoConnection() throws SQLException {
        DataSource ds = mock(DataSource.class);
        when(ds.getConnection()).thenThrow(new SQLException("Connection refused"));

        ResponseEntity<Map<String, String>> res = new HealthController(ds, Duration.ofSeconds(2)).health();
        assertThat(res.getStatusCode().value()).isEqualTo(503);
        assertThat(res.getBody()).containsEntry("database", "down");
    }

    @Test
    void downWhenTheDatabaseDoesNotAnswerInTime() throws SQLException {
        DataSource ds = mock(DataSource.class);
        when(ds.getConnection()).thenAnswer(inv -> {
            Thread.sleep(5_000);
            throw new SQLException("too late");
        });

        long start = System.nanoTime();
        ResponseEntity<Map<String, String>> res = new HealthController(ds, Duration.ofMillis(300)).health();
        assertThat(res.getStatusCode().value()).isEqualTo(503);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(3));
    }
}
