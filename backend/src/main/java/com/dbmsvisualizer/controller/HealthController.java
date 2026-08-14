package com.dbmsvisualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now().toString());

        try (Connection conn = dataSource.getConnection()) {
            health.put("database", conn.isValid(2) ? "connected" : "unreachable");
            health.put("databaseProduct", conn.getMetaData().getDatabaseProductName());
            health.put("databaseVersion", conn.getMetaData().getDatabaseProductVersion());
        } catch (Exception e) {
            health.put("database", "disconnected");
            health.put("error", e.getMessage());
        }

        return ResponseEntity.ok(health);
    }
}
