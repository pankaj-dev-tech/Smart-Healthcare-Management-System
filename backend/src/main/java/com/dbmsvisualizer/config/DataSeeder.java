package com.dbmsvisualizer.config;

import com.dbmsvisualizer.model.Course;
import com.dbmsvisualizer.model.Department;
import com.dbmsvisualizer.model.Student;
import com.dbmsvisualizer.repository.CourseRepository;
import com.dbmsvisualizer.repository.DepartmentRepository;
import com.dbmsvisualizer.repository.StudentRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;
    private final CourseRepository courseRepository;
    private final StudentRepository studentRepository;

    public DataSeeder(DepartmentRepository departmentRepository,
                      CourseRepository courseRepository,
                      StudentRepository studentRepository) {
        this.departmentRepository = departmentRepository;
        this.courseRepository = courseRepository;
        this.studentRepository = studentRepository;
    }

    @Override
    public void run(String... args) {
        // Only seed if the database is empty
        if (departmentRepository.count() > 0) {
            System.out.println("✅ Database already seeded. Skipping...");
            return;
        }

        System.out.println("🌱 Seeding database with sample data...");

        // --- Departments ---
        Department cse = departmentRepository.save(new Department("Computer Science", "CSE", "Department of Computer Science and Engineering"));
        Department ece = departmentRepository.save(new Department("Electronics", "ECE", "Department of Electronics and Communication Engineering"));
        Department me = departmentRepository.save(new Department("Mechanical", "ME", "Department of Mechanical Engineering"));
        Department ce = departmentRepository.save(new Department("Civil", "CE", "Department of Civil Engineering"));
        Department math = departmentRepository.save(new Department("Mathematics", "MATH", "Department of Mathematics and Statistics"));

        // --- Courses ---
        courseRepository.saveAll(List.of(
                new Course("Data Structures & Algorithms", "CSE201", 4, 3, cse),
                new Course("Database Management Systems", "CSE301", 4, 5, cse),
                new Course("Operating Systems", "CSE302", 3, 5, cse),
                new Course("Computer Networks", "CSE401", 3, 7, cse),
                new Course("Machine Learning", "CSE402", 4, 7, cse),
                new Course("Digital Signal Processing", "ECE201", 4, 3, ece),
                new Course("VLSI Design", "ECE301", 3, 5, ece),
                new Course("Embedded Systems", "ECE302", 4, 5, ece),
                new Course("Thermodynamics", "ME201", 3, 3, me),
                new Course("Fluid Mechanics", "ME301", 4, 5, me),
                new Course("Structural Analysis", "CE201", 4, 3, ce),
                new Course("Geotechnical Engineering", "CE301", 3, 5, ce),
                new Course("Linear Algebra", "MATH101", 3, 1, math),
                new Course("Probability & Statistics", "MATH201", 3, 3, math),
                new Course("Discrete Mathematics", "MATH202", 3, 3, math)
        ));

        // --- Students ---
        studentRepository.saveAll(List.of(
                new Student("Aarav Sharma", "aarav.sharma@university.edu", "CSE2024001", 2, cse),
                new Student("Priya Patel", "priya.patel@university.edu", "CSE2024002", 2, cse),
                new Student("Rohan Gupta", "rohan.gupta@university.edu", "CSE2023001", 3, cse),
                new Student("Ananya Singh", "ananya.singh@university.edu", "CSE2022001", 4, cse),
                new Student("Vikram Reddy", "vikram.reddy@university.edu", "CSE2024003", 2, cse),
                new Student("Divya Chauhan", "divya.chauhan@university.edu", "CSE2023002", 3, cse),
                new Student("Neha Joshi", "neha.joshi@university.edu", "ECE2024001", 2, ece),
                new Student("Arjun Mehta", "arjun.mehta@university.edu", "ECE2023001", 3, ece),
                new Student("Kavya Nair", "kavya.nair@university.edu", "ECE2024002", 2, ece),
                new Student("Aditya Kumar", "aditya.kumar@university.edu", "ME2024001", 2, me),
                new Student("Ishaan Verma", "ishaan.verma@university.edu", "ME2023001", 3, me),
                new Student("Riya Deshmukh", "riya.deshmukh@university.edu", "CE2024001", 2, ce),
                new Student("Siddharth Rao", "siddharth.rao@university.edu", "CE2023001", 3, ce),
                new Student("Meera Iyer", "meera.iyer@university.edu", "MATH2024001", 2, math),
                new Student("Karan Malhotra", "karan.malhotra@university.edu", "MATH2023001", 3, math)
        ));

        System.out.println("✅ Database seeded successfully!");
        System.out.println("   → " + departmentRepository.count() + " departments");
        System.out.println("   → " + courseRepository.count() + " courses");
        System.out.println("   → " + studentRepository.count() + " students");
    }
}
