# DBMS Visualizer

A full-stack application for exploring and visualizing database schemas, built with modern technologies.

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 19, Vite, Tailwind CSS v3, React Router |
| Backend   | Spring Boot 3.5, Spring Web, Spring Data JPA   |
| Database  | MySQL 8+                            |

## Project Structure

```
├── frontend/          React + Vite application
│   ├── src/
│   │   ├── api/       Axios HTTP client
│   │   ├── components/  Reusable UI components
│   │   └── pages/     Route-level pages
│   └── vite.config.js   Dev proxy → backend
│
├── backend/           Spring Boot application
│   ├── src/main/java/com/dbmsvisualizer/
│   │   ├── config/      CORS and DataSeeder configurations
│   │   ├── controller/  REST controllers (Student, Course, Department)
│   │   ├── model/       JPA entities (Student, Course, Department)
│   │   ├── repository/  Spring Data JPA repositories
│   │   └── service/     Business logic services
│   └── src/main/resources/
│       ├── application.properties   MySQL config
│       └── init.sql                 Database schema & sample records
```

## Prerequisites

- **Node.js** 18+
- **Java** 21+
- **MySQL** 8+ (running on `localhost:3306`)

## Getting Started

### 1. Database Setup
The application is configured to connect to MySQL on `localhost:3306` with username `root` and password `root`.

The database name is `dbms_visualizer`.
You can initialize the database using the SQL script provided at [init.sql](file:///c:/Users/PANKAJ/OneDrive/Desktop/query%20visualizer/backend/src/main/resources/init.sql):

```bash
# Log in to MySQL and run the initialization script
mysql -u root -p < backend/src/main/resources/init.sql
```

*Note: The Spring Boot app also includes a `DataSeeder` class which automatically inserts sample data on startup if the tables are empty.*

### 2. Start the Backend

```bash
cd backend
./mvnw.cmd spring-boot:run      # Windows
# or
./mvnw spring-boot:run          # macOS / Linux
```

The backend starts at **http://localhost:8080**.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at **http://localhost:5173**.

### 4. Open the App

Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

---

## API Endpoints

### System Health
- `GET /api/health` — Checks database connection and returns database system properties.

### SQL Executor
- `POST /api/sql/execute` — Execute raw SQL query. Accepts JSON body `{"query": "..."}`. Returns query results (data rows and column keys) or affected row counts.

### Database Metadata
- `GET /api/metadata/tables` — Returns a list of all tables in the current schema with their row count and metadata.
- `GET /api/metadata/tables/{tableName}` — Returns columns metadata (PK/FK flags, nullable checks, types) and all rows for a selected table.

### Department Resource
- `GET /api/departments` — List all departments.
- `GET /api/departments/{id}` — Get department details by ID.
- `GET /api/departments/code/{code}` — Get department by code (e.g. `CSE`).
- `GET /api/departments/search?name={name}` — Find departments matching name.
- `POST /api/departments` — Create a department.
- `PUT /api/departments/{id}` — Update a department.
- `DELETE /api/departments/{id}` — Delete a department.

### Course Resource
- `GET /api/courses` — List all courses.
- `GET /api/courses/{id}` — Get course details by ID.
- `GET /api/courses/department/{deptId}` — List courses under a specific department.
- `GET /api/courses/semester/{semester}` — List courses offered in a specific semester.
- `GET /api/courses/search?name={name}` — Search courses by name.
- `POST /api/courses?departmentId={deptId}` — Create a course and associate with a department.
- `PUT /api/courses/{id}?departmentId={deptId}` — Update a course.
- `DELETE /api/courses/{id}` — Delete a course.

### Student Resource
- `GET /api/students` — List all students.
- `GET /api/students/{id}` — Get student details by ID.
- `GET /api/students/email/{email}` — Find student by email.
- `GET /api/students/roll/{rollNumber}` — Find student by roll number.
- `GET /api/students/department/{deptId}` — List students enrolled in a department.
- `GET /api/students/year/{year}` — List students by year of study.
- `GET /api/students/search?name={name}` — Search students by name.
- `POST /api/students?departmentId={deptId}` — Enroll a student and assign to a department.
- `PUT /api/students/{id}?departmentId={deptId}` — Update student profile.
- `DELETE /api/students/{id}` — De-register a student.

---

## Development Details
- **Cross-Origin Resource Sharing (CORS)**: Preconfigured to allow connections from the React client on port `5173`.
- **Bidirectional Serialization**: Handled using Jackson `@JsonManagedReference` and `@JsonBackReference` annotations to prevent infinite recursion while maintaining entity navigation.
