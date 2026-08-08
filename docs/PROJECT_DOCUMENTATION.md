# WorkBench Enterprise Platform Documentation

Comprehensive architecture, API reference, multi-tenant database specifications, and organization onboarding guide for the **WorkBench Enterprise Platform**.

---

## 1. About the Project & Uses of this Application

### Overview
**WorkBench** is an Enterprise Multi-Tenant Learning Management System (LMS) engineered for higher education institutions, universities, and technical colleges. It enables university organizations to host structured course catalogs, stream video lectures for syllabus topics, track student progress, and maintain isolated database storage per college campus.

### Key Use Cases
- **Multi-Campus University Management**: Universities (e.g., JNTUK, AITS, KLU, VNRVJIET) maintain dedicated, isolated MongoDB databases for student records, enrollment metrics, and topic completion logs.
- **Roll Number Student Authentication**: Students authenticate using their university roll numbers (e.g. `19KH1A0512`, `23A91A0401`) with plain-text password verification.
- **Syllabus & Video Lecture Streaming**: Pre-defined course content structured into modules and video lectures.
- **Permanent Progress & Completion Tracking**: Progress percentages and topic completions are permanently locked in MongoDB Atlas without rollbacks.
- **Zero-Code Configuration**: College organization rules, roll number codes, and branding assets are managed strictly via environment files (`.env`).

---

## 2. Features of the Application

| Feature | Technical Implementation | Purpose / Benefit |
| :--- | :--- | :--- |
| **Multi-Tenant DB Isolation** | Mongoose `useDb("wb_org_<orgId>")` connection pool manager. | Guarantees complete data segregation per college campus (`wb_org_jntuk`, `wb_org_aits`). |
| **Roll Number Code Auto-Routing** | `.env` string code extraction (index 2 & 3: `19KH...` -> `KH` -> `jntuk`). | Automatically routes database queries to the student's campus DB based on roll number. |
| **Dynamic Header Branding** | `.env` JSON map (`VITE_ORG_DETAILS`). | Displays student's college logo image, name, and campus code badge upon login. |
| **Pre-Defined Course Catalog** | Centralized `coursesData.js` and `all_courses.json`. | Eliminates AI-generated placeholders with real syllabus topics and video player. |
| **Single Source of Truth DB** | Database-first API polling & sync in `enrollmentService.js`. | Deleting records in MongoDB instantly updates client state to "Enroll Now". |
| **Responsive Mobile & Tablet UI** | Tailwind CSS flex/grid layout with horizontal touch scroll. | Touch-friendly category scrolling and responsive filter controls across mobile & tablet viewports. |

---

## 3. API Endpoints Reference

Base API URL: `https://wb-be-q2u6.onrender.com/api` (or `http://localhost:5000/api` locally).

### A. Authentication API (`/api/auth`)

#### 1. Login Student (`POST /api/auth/login`)
- **Use**: Authenticates a student using Roll Number (Username) and Plain Text Password, returning a signed JWT token and Organization profile.
- **Request Headers**: `Content-Type: application/json`, `x-tenant-id: <orgId>` (optional).
- **Request Body**:
  ```json
  {
    "username": "19KH1A0512",
    "password": "123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6991ae5e15b08228bf1b2beb",
      "username": "19KH1A0512",
      "email": "19KH1A0512@jntuk.edu.in",
      "role": "student",
      "name": "Boda Subramani",
      "branch": "CSE",
      "orgId": "jntuk",
      "organization": "JNTUK College of Engineering"
    }
  }
  ```

#### 2. Request Password Reset Token (`POST /api/auth/forgot-password`)
- **Use**: Generates password reset token for a student account.
- **Request Body**: `{ "email": "19KH1A0512@jntuk.edu.in" }`

#### 3. Reset Password (`POST /api/auth/reset-password/:token`)
- **Use**: Updates student password directly as plain text string.
- **Request Body**: `{ "newPassword": "MyNewPassword123" }`

---

### B. Course Enrollments API (`/api/enrollments`)

#### 1. Enroll Student in Course (`POST /api/enrollments/enroll`)
- **Use**: Creates or updates a student course enrollment in the target organization's Mongoose collection (`course_enrollments`).
- **Request Headers**: `x-tenant-id: <orgId>`
- **Request Body**:
  ```json
  {
    "userId": "19KH1A0512",
    "studentEmail": "19KH1A0512@jntuk.edu.in",
    "studentName": "Boda Subramani",
    "courseId": "web-dev-bootcamp",
    "courseTitle": "Full-Stack Web Development Bootcamp"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Successfully enrolled in course!",
    "tenantId": "jntuk",
    "enrollment": {
      "userId": "19KH1A0512",
      "studentEmail": "19KH1A0512@jntuk.edu.in",
      "courseId": "web-dev-bootcamp",
      "courseTitle": "Full-Stack Web Development Bootcamp",
      "status": "Enrolled",
      "completedTopics": [],
      "progressPercentage": 0
    }
  }
  ```

#### 2. Update Topic Progress (`POST /api/enrollments/progress`)
- **Use**: Locks completed syllabus topics and updates database progress percentage without rollback.
- **Request Body**:
  ```json
  {
    "userId": "19KH1A0512",
    "studentEmail": "19KH1A0512@jntuk.edu.in",
    "courseId": "web-dev-bootcamp",
    "completedTopics": ["html-basics", "css-flexbox"],
    "totalTopics": 10
  }
  ```

#### 3. Fetch User Enrollments (`GET /api/enrollments/user/:studentEmail`)
- **Use**: Fetches all course enrollment records for a student from their college organization database.
- **URL Parameter**: `:studentEmail` (Roll Number or Email address).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "tenantId": "jntuk",
    "count": 1,
    "enrollments": [ ... ]
  }
  ```

#### 4. Fetch Organization Enrollment Statistics (`GET /api/enrollments/stats`)
- **Use**: Retrieves data entry counts (total enrollments, completed, in-progress) for active campus.

---

## 4. JSON Lists and Schemas

### A. Environment Configuration JSON Schemas (`.env`)

#### 1. College Code Mapping (`COLLEGE_CODES` / `VITE_COLLEGE_CODES`)
```json
{
  "KH": "jntuk",
  "A9": "aits"
}
```

#### 2. Organization Details & Branding (`ORG_DETAILS` / `VITE_ORG_DETAILS`)
```json
{
  "jntuk": {
    "name": "JNTUK College of Engineering",
    "code": "JNTUK",
    "logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAueod_gGwwOzhA-qe_7XumPbthYQtZuvSFJ8mODayPu6kfWgXvWvQb0Fm&s=10"
  },
  "aits": {
    "name": "AITS Rajampet",
    "code": "AITS",
    "logo": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80"
  }
}
```

---

### B. Mongoose Database Models & Schemas

#### 1. User Schema (`BE/models/User.js` -> Collection: `stu_database`)
```javascript
{
  username: { type: String, required: true, index: true }, // Student Roll Number (e.g. 19KH1A0512)
  email: { type: String, required: true },
  password: { type: String, required: true }, // Stored as plain text string
  branch: { type: String, default: "CSE" },
  fullname: { type: String, required: true },
  orgId: { type: String, required: true }, // e.g. "jntuk", "aits"
  organization: { type: String, required: true },
  role: { type: String, default: "student" },
  resetToken: String,
  resetTokenExpiry: Date
}
```

#### 2. Course Enrollment Schema (`BE/models/CourseEnrollment.js` -> Collection: `course_enrollments`)
```javascript
{
  userId: { type: String, required: true, index: true }, // Roll Number
  studentEmail: { type: String, required: true },
  studentName: { type: String, default: "Student" },
  courseId: { type: String, required: true, index: true },
  courseTitle: { type: String, required: true },
  enrolledAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["Enrolled", "In-Progress", "Completed"], default: "Enrolled" },
  completedTopics: { type: [String], default: [] },
  progressPercentage: { type: Number, min: 0, max: 100, default: 0 },
  lastAccessedAt: { type: Date, default: Date.now },
  completionDate: { type: Date, default: null }
}
```

---

## 5. Steps for Onboarding a New Organization

Follow these steps to onboard a new college organization (e.g., K L University):

### Step 1: Run the Automated CLI Tool (Recommended)
Execute the interactive CLI onboarding script:
```bash
cd e:\WorkBench\BE
npm run onboard
```

### Step 2: Provide Organization Details
When prompted by the script, input:
1. **Organization Name**: `K L Deemed to be University`
2. **Organization ID**: `kluniv`
3. **Roll Number College Code**: `KL`
4. **Logo Image URL**: `https://example.com/kl_logo.png`
5. **Student 1 Roll Number & Password**: `23KL1A1201` | `Student@123`
6. **Student 2 Roll Number & Password**: `23KL1A0502` | `Student@123`

The script automatically provisions `wb_org_kluniv`, seeds the databases, and updates `BE/.env` and `FE/FE_WB/.env`.

---

## 6. Automated Organization Onboarding Script Guide

The onboarding tool is located in [BE/scripts/onboardOrganization.js](file:///e:/WorkBench/BE/scripts/onboardOrganization.js).

### Running the Onboarding Script
From the `BE` directory:
```bash
node scripts/onboardOrganization.js
```
*or using npm script:*
```bash
npm run onboard
```

### What the Script Performs Automatically
1. **CLI Inputs**: Interactively collects organization metadata and student roll numbers.
2. **Database Provisioning**: Connects to MongoDB Atlas and creates `wb_org_<orgId>` database with `stu_database` and `course_enrollments` collections.
3. **Account Seeding**: Inserts student records with plain-text passwords and initial course enrollments.
4. **Environment Sync**: Appends `COLLEGE_CODES` and `ORG_DETAILS` in both `BE/.env` and `FE/FE_WB/.env` without requiring code edits.
