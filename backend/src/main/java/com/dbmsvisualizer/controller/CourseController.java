package com.dbmsvisualizer.controller;

import com.dbmsvisualizer.model.Course;
import com.dbmsvisualizer.service.CourseService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping
    public ResponseEntity<List<Course>> getAll() {
        return ResponseEntity.ok(courseService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Course> getById(@PathVariable Long id) {
        return courseService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<Course> getByCode(@PathVariable String code) {
        return courseService.findByCode(code)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/department/{departmentId}")
    public ResponseEntity<List<Course>> getByDepartment(@PathVariable Long departmentId) {
        return ResponseEntity.ok(courseService.findByDepartmentId(departmentId));
    }

    @GetMapping("/semester/{semester}")
    public ResponseEntity<List<Course>> getBySemester(@PathVariable Integer semester) {
        return ResponseEntity.ok(courseService.findBySemester(semester));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Course>> searchByName(@RequestParam String name) {
        return ResponseEntity.ok(courseService.searchByName(name));
    }

    @PostMapping
    public ResponseEntity<Course> create(@RequestBody Course course,
                                         @RequestParam(required = false) Long departmentId) {
        Course saved = courseService.save(course, departmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Course> update(@PathVariable Long id,
                                         @RequestBody Course course,
                                         @RequestParam(required = false) Long departmentId) {
        try {
            Course updated = courseService.update(id, course, departmentId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseService.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/count")
    public ResponseEntity<Long> count() {
        return ResponseEntity.ok(courseService.count());
    }
}
