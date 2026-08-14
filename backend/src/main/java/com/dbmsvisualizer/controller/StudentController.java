package com.dbmsvisualizer.controller;

import com.dbmsvisualizer.model.Student;
import com.dbmsvisualizer.service.StudentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping
    public ResponseEntity<List<Student>> getAll() {
        return ResponseEntity.ok(studentService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Student> getById(@PathVariable Long id) {
        return studentService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<Student> getByEmail(@PathVariable String email) {
        return studentService.findByEmail(email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/roll/{rollNumber}")
    public ResponseEntity<Student> getByRollNumber(@PathVariable String rollNumber) {
        return studentService.findByRollNumber(rollNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/department/{departmentId}")
    public ResponseEntity<List<Student>> getByDepartment(@PathVariable Long departmentId) {
        return ResponseEntity.ok(studentService.findByDepartmentId(departmentId));
    }

    @GetMapping("/year/{year}")
    public ResponseEntity<List<Student>> getByYear(@PathVariable Integer year) {
        return ResponseEntity.ok(studentService.findByYearOfStudy(year));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Student>> searchByName(@RequestParam String name) {
        return ResponseEntity.ok(studentService.searchByName(name));
    }

    @PostMapping
    public ResponseEntity<Student> create(@RequestBody Student student,
                                          @RequestParam(required = false) Long departmentId) {
        Student saved = studentService.save(student, departmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Student> update(@PathVariable Long id,
                                          @RequestBody Student student,
                                          @RequestParam(required = false) Long departmentId) {
        try {
            Student updated = studentService.update(id, student, departmentId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        studentService.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/count")
    public ResponseEntity<Long> count() {
        return ResponseEntity.ok(studentService.count());
    }
}
