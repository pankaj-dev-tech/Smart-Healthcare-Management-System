package com.dbmsvisualizer.service;

import com.dbmsvisualizer.model.Department;
import com.dbmsvisualizer.model.Student;
import com.dbmsvisualizer.repository.DepartmentRepository;
import com.dbmsvisualizer.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class StudentService {

    private final StudentRepository studentRepository;
    private final DepartmentRepository departmentRepository;

    public StudentService(StudentRepository studentRepository, DepartmentRepository departmentRepository) {
        this.studentRepository = studentRepository;
        this.departmentRepository = departmentRepository;
    }

    public List<Student> findAll() {
        return studentRepository.findAll();
    }

    public Optional<Student> findById(Long id) {
        return studentRepository.findById(id);
    }

    public Optional<Student> findByEmail(String email) {
        return studentRepository.findByEmail(email);
    }

    public Optional<Student> findByRollNumber(String rollNumber) {
        return studentRepository.findByRollNumber(rollNumber);
    }

    public List<Student> findByDepartmentId(Long departmentId) {
        return studentRepository.findByDepartment_Id(departmentId);
    }

    public List<Student> searchByName(String name) {
        return studentRepository.findByNameContainingIgnoreCase(name);
    }

    public List<Student> findByYearOfStudy(Integer year) {
        return studentRepository.findByYearOfStudy(year);
    }

    public Student save(Student student, Long departmentId) {
        if (departmentId != null) {
            Department department = departmentRepository.findById(departmentId)
                    .orElseThrow(() -> new RuntimeException("Department not found with id: " + departmentId));
            student.setDepartment(department);
        }
        return studentRepository.save(student);
    }

    public Student update(Long id, Student updated, Long departmentId) {
        return studentRepository.findById(id)
                .map(student -> {
                    student.setName(updated.getName());
                    student.setEmail(updated.getEmail());
                    student.setRollNumber(updated.getRollNumber());
                    student.setYearOfStudy(updated.getYearOfStudy());
                    if (departmentId != null) {
                        Department department = departmentRepository.findById(departmentId)
                                .orElseThrow(() -> new RuntimeException("Department not found with id: " + departmentId));
                        student.setDepartment(department);
                    }
                    return studentRepository.save(student);
                })
                .orElseThrow(() -> new RuntimeException("Student not found with id: " + id));
    }

    public void deleteById(Long id) {
        studentRepository.deleteById(id);
    }

    public long count() {
        return studentRepository.count();
    }
}
