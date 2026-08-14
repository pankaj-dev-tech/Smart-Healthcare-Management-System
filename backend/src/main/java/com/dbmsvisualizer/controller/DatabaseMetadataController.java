package com.dbmsvisualizer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/metadata")
public class DatabaseMetadataController {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMetadataController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/tables")
    public ResponseEntity<List<Map<String, Object>>> getTables() {
        try {
            String dbName = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
            if (dbName == null) {
                return ResponseEntity.status(500).body(null);
            }

            // Query metadata for table names
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME as tableName, TABLE_ROWS as rowCount, CREATE_TIME as createTime " +
                "FROM information_schema.tables " +
                "WHERE table_schema = ?", dbName
            );

            // Fetch live accurate counts
            for (Map<String, Object> table : tables) {
                String tableName = (String) table.get("tableName");
                try {
                    Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `" + tableName + "`", Integer.class);
                    table.put("rowCount", count);
                } catch (Exception e) {
                    // Fallback to information_schema count
                }
            }

            return ResponseEntity.ok(tables);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    @GetMapping("/tables/{tableName}")
    public ResponseEntity<Map<String, Object>> getTableData(@PathVariable String tableName) {
        Map<String, Object> details = new LinkedHashMap<>();
        try {
            String dbName = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
            
            // Validate table name exists to prevent SQL injection
            Long exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
                Long.class, dbName, tableName
            );

            if (exists == null || exists == 0) {
                return ResponseEntity.notFound().build();
            }

            // Get columns information
            List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                "SELECT COLUMN_NAME as columnName, DATA_TYPE as dataType, COLUMN_KEY as columnKey, IS_NULLABLE as isNullable " +
                "FROM information_schema.columns " +
                "WHERE table_schema = ? AND table_name = ? " +
                "ORDER BY ORDINAL_POSITION", dbName, tableName
            );
            details.put("columns", columns);

            // Get table data
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT * FROM `" + tableName + "`");
            details.put("rows", rows);
            
            return ResponseEntity.ok(details);
        } catch (Exception e) {
            details.put("error", e.getMessage());
            return ResponseEntity.status(500).body(details);
        }
    }
}
