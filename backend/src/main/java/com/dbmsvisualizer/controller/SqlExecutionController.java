package com.dbmsvisualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/sql")
public class SqlExecutionController {

    private final JdbcTemplate jdbcTemplate;

    public SqlExecutionController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> executeSql(@RequestBody Map<String, String> request) {
        String sql = request.get("query");
        Map<String, Object> result = new LinkedHashMap<>();

        if (sql == null || sql.trim().isEmpty()) {
            result.put("success", false);
            result.put("error", "Query cannot be empty.");
            return ResponseEntity.badRequest().body(result);
        }

        String trimmedSql = sql.trim().toLowerCase();
        long startTime = System.nanoTime();
        try {
            if (trimmedSql.startsWith("select") || 
                trimmedSql.startsWith("show") || 
                trimmedSql.startsWith("describe") || 
                trimmedSql.startsWith("explain")) {
                
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
                long endTime = System.nanoTime();
                result.put("success", true);
                result.put("type", "SELECT");
                result.put("rowCount", rows.size());
                result.put("data", rows);
                result.put("executionTimeMs", (endTime - startTime) / 1_000_000.0);
                
                if (!rows.isEmpty()) {
                    result.put("columns", rows.get(0).keySet());
                } else {
                    result.put("columns", Collections.emptyList());
                }
            } else {
                int affectedRows = jdbcTemplate.update(sql);
                long endTime = System.nanoTime();
                result.put("success", true);
                result.put("type", "DML/DDL");
                result.put("affectedRows", affectedRows);
                result.put("executionTimeMs", (endTime - startTime) / 1_000_000.0);
            }
        } catch (Exception e) {
            long endTime = System.nanoTime();
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("executionTimeMs", (endTime - startTime) / 1_000_000.0);
        }

        return ResponseEntity.ok(result);
    }
}
