package com.dbmsvisualizer.service;

import com.dbmsvisualizer.model.Course;
import com.dbmsvisualizer.model.Department;
import com.dbmsvisualizer.repository.CourseRepository;
import com.dbmsvisualizer.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class CourseService {

    private final CourseRepository courseRepository;
    private final DepartmentRepository departmentRepository;

    public CourseService(CourseRepository courseRepository, DepartmentRepository departmentRepository) {
        this.courseRepository = courseRepository;
        this.departmentRepository = departmentRepository;
    }

    public List<Course> findAll() {
        return courseRepository.findAll();
    }

    public Optional<Course> findById(Long id) {
        return courseRepository.findById(id);
    }

    public Optional<Course> findByCode(String code) {
        return courseRepository.findByCode(code);
    }

    public List<Course> findByDepartmentId(Long departmentId) {
        return courseRepository.findByDepartment_Id(departmentId);
    }

    public List<Course> searchByName(String name) {
        return courseRepository.findByNameContainingIgnoreCase(name);
    }

    public List<Course> findBySemester(Integer semester) {
        return courseRepository.findBySemester(semester);
    }

    public Course save(Course course, Long departmentId) {
        if (departmentId != null) {
            Department department = departmentRepository.findById(departmentId)
                    .orElseThrow(() -> new RuntimeException("Department not found with id: " + departmentId));
            course.setDepartment(department);
        }
        return courseRepository.save(course);
    }

    public Course update(Long id, Course updated, Long departmentId) {
        return courseRepository.findById(id)
                .map(course -> {
                    course.setName(updated.getName());
                    course.setCode(updated.getCode());
                    course.setCredits(updated.getCredits());
                    course.setSemester(updated.getSemester());
                    if (departmentId != null) {
                        Department department = departmentRepository.findById(departmentId)
                                .orElseThrow(() -> new RuntimeException("Department not found with id: " + departmentId));
                        course.setDepartment(department);
                    }
                    return courseRepository.save(course);
                })
                .orElseThrow(() -> new RuntimeException("Course not found with id: " + id));
    }

    public void deleteById(Long id) {
        courseRepository.deleteById(id);
    }

    public long count() {
        return courseRepository.count();
    }
}
