package com.dbmsvisualizer.repository;

import com.dbmsvisualizer.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {

    Optional<Student> findByEmail(String email);

    Optional<Student> findByRollNumber(String rollNumber);

    List<Student> findByDepartmentId(Long departmentId);

    List<Student> findByNameContainingIgnoreCase(String name);

    List<Student> findByYearOfStudy(Integer yearOfStudy);
}
