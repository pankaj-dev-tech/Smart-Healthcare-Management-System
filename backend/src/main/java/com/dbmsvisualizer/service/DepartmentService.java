package com.dbmsvisualizer.service;

import com.dbmsvisualizer.model.Department;
import com.dbmsvisualizer.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class DepartmentService {

    private final DepartmentRepository departmentRepository;

    public DepartmentService(DepartmentRepository departmentRepository) {
        this.departmentRepository = departmentRepository;
    }

    public List<Department> findAll() {
        return departmentRepository.findAll();
    }

    public Optional<Department> findById(Long id) {
        return departmentRepository.findById(id);
    }

    public Optional<Department> findByCode(String code) {
        return departmentRepository.findByCode(code);
    }

    public List<Department> searchByName(String name) {
        return departmentRepository.findByNameContainingIgnoreCase(name);
    }

    public Department save(Department department) {
        return departmentRepository.save(department);
    }

    public Department update(Long id, Department updated) {
        return departmentRepository.findById(id)
                .map(dept -> {
                    dept.setName(updated.getName());
                    dept.setCode(updated.getCode());
                    dept.setDescription(updated.getDescription());
                    return departmentRepository.save(dept);
                })
                .orElseThrow(() -> new RuntimeException("Department not found with id: " + id));
    }

    public void deleteById(Long id) {
        departmentRepository.deleteById(id);
    }

    public long count() {
        return departmentRepository.count();
    }
}
