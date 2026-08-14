-- ============================================
-- DBMS Visualizer - Database Initialization
-- Run: mysql -u root -p < init.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS dbms_visualizer;
USE dbms_visualizer;

-- ---- Department ----
CREATE TABLE IF NOT EXISTS department (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---- Course ----
CREATE TABLE IF NOT EXISTS course (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(15) NOT NULL UNIQUE,
    credits INT NOT NULL DEFAULT 3,
    semester INT,
    department_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES department(id)
);

-- ---- Student ----
CREATE TABLE IF NOT EXISTS student (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    roll_number VARCHAR(20) NOT NULL UNIQUE,
    year_of_study INT DEFAULT 1,
    department_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES department(id)
);

-- ============================================
-- Sample Data
-- ============================================

-- Departments
INSERT INTO department (name, code, description) VALUES
('Computer Science', 'CSE', 'Department of Computer Science and Engineering'),
('Electronics', 'ECE', 'Department of Electronics and Communication Engineering'),
('Mechanical', 'ME', 'Department of Mechanical Engineering'),
('Civil', 'CE', 'Department of Civil Engineering'),
('Mathematics', 'MATH', 'Department of Mathematics and Statistics');

-- Courses
INSERT INTO course (name, code, credits, semester, department_id) VALUES
('Data Structures & Algorithms', 'CSE201', 4, 3, 1),
('Database Management Systems', 'CSE301', 4, 5, 1),
('Operating Systems', 'CSE302', 3, 5, 1),
('Computer Networks', 'CSE401', 3, 7, 1),
('Machine Learning', 'CSE402', 4, 7, 1),
('Digital Signal Processing', 'ECE201', 4, 3, 2),
('VLSI Design', 'ECE301', 3, 5, 2),
('Embedded Systems', 'ECE302', 4, 5, 2),
('Thermodynamics', 'ME201', 3, 3, 3),
('Fluid Mechanics', 'ME301', 4, 5, 3),
('Structural Analysis', 'CE201', 4, 3, 4),
('Geotechnical Engineering', 'CE301', 3, 5, 4),
('Linear Algebra', 'MATH101', 3, 1, 5),
('Probability & Statistics', 'MATH201', 3, 3, 5),
('Discrete Mathematics', 'MATH202', 3, 3, 5);

-- Students
INSERT INTO student (name, email, roll_number, year_of_study, department_id) VALUES
('Aarav Sharma', 'aarav.sharma@university.edu', 'CSE2024001', 2, 1),
('Priya Patel', 'priya.patel@university.edu', 'CSE2024002', 2, 1),
('Rohan Gupta', 'rohan.gupta@university.edu', 'CSE2023001', 3, 1),
('Ananya Singh', 'ananya.singh@university.edu', 'CSE2022001', 4, 1),
('Vikram Reddy', 'vikram.reddy@university.edu', 'CSE2024003', 2, 1),
('Neha Joshi', 'neha.joshi@university.edu', 'ECE2024001', 2, 2),
('Arjun Mehta', 'arjun.mehta@university.edu', 'ECE2023001', 3, 2),
('Kavya Nair', 'kavya.nair@university.edu', 'ECE2024002', 2, 2),
('Aditya Kumar', 'aditya.kumar@university.edu', 'ME2024001', 2, 3),
('Ishaan Verma', 'ishaan.verma@university.edu', 'ME2023001', 3, 3),
('Riya Deshmukh', 'riya.deshmukh@university.edu', 'CE2024001', 2, 4),
('Siddharth Rao', 'siddharth.rao@university.edu', 'CE2023001', 3, 4),
('Meera Iyer', 'meera.iyer@university.edu', 'MATH2024001', 2, 5),
('Karan Malhotra', 'karan.malhotra@university.edu', 'MATH2023001', 3, 5),
('Divya Chauhan', 'divya.chauhan@university.edu', 'CSE2023002', 3, 1);
