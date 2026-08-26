import mongoose from "mongoose";
import dotenv from "dotenv";
import resolveStudentBranch from "./branchResolver.js";

dotenv.config();

// Map of cached tenant connections & models
const tenantConnectionsMap = {};

// Cache for tenant branch models to avoid re-compiling schemas
const tenantBranchModelsMap = {};

/**
 * Resolves a tenant-specific Mongoose database connection and models.
 * @param {string} tenantId - Organization identifier (e.g. 'jntuk', 'svck', 'aits')
 * @returns {object} { connection, models: { User, CourseEnrollment, Exam, ExamQuestion, ExamSubmission, getBranchResultsModel } }
 */
export const getTenantContext = (tenantId = "default") => {
  const cleanTenantId = (tenantId || "default").toString().toLowerCase().trim();
  const dbName = cleanTenantId === "default" ? "DB1" : `wb_org_${cleanTenantId}`;

  if (tenantConnectionsMap[cleanTenantId]) {
    return tenantConnectionsMap[cleanTenantId];
  }

  // Get base connection or use current connection
  const baseConn = mongoose.connection;

  if (!baseConn || baseConn.readyState !== 1) {
    return {
      connection: mongoose.connection,
      models: {
        User: mongoose.models.User,
        CourseEnrollment: mongoose.models.CourseEnrollment
      }
    };
  }

  // Create isolated database context using useDb for current Organization
  const tenantDb = baseConn.useDb(dbName, { useCache: true });

  // 1. User Schema & Model ('stu_database')
  const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    fullname: String,
    branch: { type: String, required: true }, // e.g. "CSE"
    year: { type: Number, required: true }, // e.g. 1, 2, 3, 4
    semester: { type: Number, default: 1 }, // e.g. 1, 2
    section: { type: String, default: "A" }, // e.g. "A"
    role: { type: String, default: "student" },
    orgId: String,
    resetToken: String,
    resetTokenExpiry: Date,
    createdAt: { type: Date, default: Date.now }
  });

  // 2. Course Enrollment Schema & Model ('course_enrollments')
  const courseEnrollmentSchema = mongoose.models.CourseEnrollment?.schema || new mongoose.Schema({
    userId: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentName: { type: String, default: "Student" },
    courseId: { type: String, required: true },
    courseTitle: { type: String, required: true },
    enrolledAt: { type: Date, default: Date.now },
    status: { type: String, default: "Enrolled" },
    completedTopics: { type: [String], default: [] },
    progressPercentage: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
    completionDate: { type: Date, default: null }
  });

  // 3. Organization Exams Schema & Model ('org_exams')
  const examSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    code: { type: String, required: true },
    department: { type: String, default: "cse", lowercase: true, trim: true },
    departments: [{ type: String, lowercase: true, trim: true }],
    year: { type: Number, default: 3 },
    orgId: { type: String, required: true },
    category: { type: String, default: "Mid-Term Examination" },
    durationMinutes: { type: Number, default: 30 },
    totalMarks: { type: Number, default: 20 },
    passPercentage: { type: Number, default: 40 },
    status: { type: String, default: "active" },
    isIpRestrictionEnabled: { type: Boolean, default: true },
    allowedIpPool: [{
      ip: { type: String, required: true },
      label: { type: String, default: "College Lab Computer" },
      addedAt: { type: Date, default: Date.now }
    }],
    instructions: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  });

  // 4. Organization Exam Questions Schema & Model ('exam_questions' collection under org DB)
  const examQuestionSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    examId: { type: String, required: true },
    orgId: { type: String, required: true },
    subject: { type: String, default: "General" },
    text: { type: String, required: true },
    codeSnippet: { type: String, default: "" },
    options: [{ type: String, required: true }],
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String, default: "" },
    marks: { type: Number, default: 2 },
    createdAt: { type: Date, default: Date.now }
  });

  // 5. Exam Submission Schema (for branch-specific collections)
  const examSubmissionSchema = new mongoose.Schema({
    examId: { type: String, required: true },
    examTitle: { type: String, required: true },
    userId: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentName: { type: String, default: "Student" },
    branch: { type: String, required: true },
    orgId: { type: String, required: true },
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    percentage: { type: Number, required: true },
    grade: { type: String, required: true },
    passed: { type: Boolean, required: true },
    violationsCount: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    answers: { type: Map, of: Number },
    submittedAt: { type: Date, default: Date.now }
  });

  // 6. Dedicated College Subjects Schema & Model ('college_subjects')
  const subjectSchema = new mongoose.Schema({
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    department: { type: String, required: true }, // cse, ece, eee, mech, civil
    year: { type: Number, required: true }, // 1, 2, 3, 4
    semester: { type: Number, default: 1 }, // 1, 2
    type: { type: String, default: "Theory" }, // Theory, Lab / Practical
    credits: { type: Number, default: 3 },
    orgId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  });

  // 7. Staff Database Schema & Model ('staff_database')
  const staffSchema = mongoose.models.StaffUser?.schema || new mongoose.Schema({
    staffId: { type: String, required: true },
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "lecturer" },
    department: { type: String, default: "all" },
    phone: String,
    assignedSubjects: Array,
    orgId: { type: String, default: cleanTenantId }
  });

  // 8. Attendance Schema & Model ('attendance_records')
  const attendanceSchema = new mongoose.Schema({
    orgId: { type: String, default: cleanTenantId },
    department: { type: String, required: true },
    year: { type: Number, required: true },
    semester: { type: Number, default: 1 },
    section: { type: String, default: "A" },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    facultyId: { type: String, required: true },
    facultyName: { type: String, required: true },
    date: { type: String, required: true },
    periods: { type: [Number], default: [1] },
    records: [
      {
        studentId: String,
        rollNumber: String,
        studentName: String,
        status: { type: String, default: "present" }
      }
    ],
    createdAt: { type: Date, default: Date.now }
  });

  // 9. Organization Branch / Department Schema & Model ('college_branches')
  const branchSchema = new mongoose.Schema({
    branchCode: { type: String, required: true, uppercase: true, trim: true },
    branchName: { type: String, required: true, trim: true },
    status: { type: String, default: "active" },
    orgId: { type: String, default: cleanTenantId },
    createdAt: { type: Date, default: Date.now }
  });

  // 10. Organization Notifications & Updates Schema & Model ('college_notifications')
  const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, default: "Academic" },
    department: { type: String, default: "all", lowercase: true, trim: true },
    departments: [{ type: String, lowercase: true, trim: true }],
    year: { type: String, default: "all" },
    priority: { type: String, default: "normal" },
    isNew: { type: Boolean, default: true },
    attachment: { type: String, default: "" },
    createdBy: { type: String, default: "College Admin" },
    orgId: { type: String, default: cleanTenantId },
    createdAt: { type: Date, default: Date.now }
  });

  const TenantUser = tenantDb.model("User", userSchema, "stu_database");
  const TenantCourseEnrollment = tenantDb.model("CourseEnrollment", courseEnrollmentSchema, "course_enrollments");
  const TenantExam = tenantDb.model("Exam", examSchema, "org_exams");
  const TenantExamQuestion = tenantDb.model("ExamQuestion", examQuestionSchema, "exam_questions");
  const TenantExamSubmission = tenantDb.model("ExamSubmission", examSubmissionSchema, "exam_submissions");
  const TenantSubject = tenantDb.model("Subject", subjectSchema, "college_subjects");
  const TenantStaffUser = tenantDb.model("StaffUser", staffSchema, "staff_database");
  const TenantAttendance = tenantDb.model("Attendance", attendanceSchema, "attendance_records");
  const TenantBranch = tenantDb.model("Branch", branchSchema, "college_branches");
  const TenantNotification = tenantDb.model("Notification", notificationSchema, "college_notifications");

  // Auto-seed default branches and initial announcements if collections are empty
  (async () => {
    try {
      const bCount = await TenantBranch.countDocuments();
      if (bCount === 0) {
        const defaultBranches = [
          { branchCode: "CSE", branchName: "Computer Science & Engineering", status: "active", orgId: cleanTenantId },
          { branchCode: "ECE", branchName: "Electronics & Communication Engineering", status: "active", orgId: cleanTenantId },
          { branchCode: "EEE", branchName: "Electrical & Electronics Engineering", status: "active", orgId: cleanTenantId },
          { branchCode: "MECH", branchName: "Mechanical Engineering", status: "active", orgId: cleanTenantId },
          { branchCode: "CIVIL", branchName: "Civil Engineering", status: "active", orgId: cleanTenantId },
          { branchCode: "IT", branchName: "Information Technology", status: "active", orgId: cleanTenantId },
          { branchCode: "AIML", branchName: "Artificial Intelligence & Machine Learning", status: "active", orgId: cleanTenantId }
        ];
        await TenantBranch.insertMany(defaultBranches);
      }

      const nCount = await TenantNotification.countDocuments();
      if (nCount === 0) {
        const defaultAnnouncements = [
          {
            title: `${cleanTenantId.toUpperCase()} Academic Calendar & Semester Examination Schedule`,
            description: `Official announcement: End semester examination schedules and lab evaluation guidelines have been published for all departments.`,
            category: "Exams",
            department: "all",
            departments: ["all"],
            year: "all",
            priority: "urgent",
            isNew: true,
            createdBy: "Office of Controller of Examinations",
            orgId: cleanTenantId
          },
          {
            title: "Campus Placement Drive & Technical Skill Workshops",
            description: "Special training sessions on Data Structures, Algorithms, and System Design are scheduled for 3rd and 4th-year students.",
            category: "Events",
            department: "all",
            departments: ["all"],
            year: "all",
            priority: "high",
            isNew: true,
            createdBy: "Training & Placement Cell",
            orgId: cleanTenantId
          }
        ];
        await TenantNotification.insertMany(defaultAnnouncements);
      }
    } catch (seedErr) {}
  })();

  /**
   * Returns a branch-specific results collection model inside current Organization DB (wb_org_[orgId])
   * Collections: 'cse_exam_results', 'ece_exam_results', 'eee_exam_results', 'mech_exam_results', 'civil_exam_results'
   */
  const getBranchResultsModel = (rawBranch = "cse") => {
    const cleanBranch = resolveStudentBranch(rawBranch);
    const collectionName = `${cleanBranch.toLowerCase()}_exam_results`;
    const cacheKey = `${cleanTenantId}_${collectionName}`;

    if (tenantBranchModelsMap[cacheKey]) {
      return tenantBranchModelsMap[cacheKey];
    }

    const model = tenantDb.model(collectionName, examSubmissionSchema, collectionName);
    tenantBranchModelsMap[cacheKey] = model;
    return model;
  };

  const context = {
    tenantId: cleanTenantId,
    dbName,
    connection: tenantDb,
    models: {
      User: TenantUser,
      CourseEnrollment: TenantCourseEnrollment,
      Exam: TenantExam,
      ExamQuestion: TenantExamQuestion,
      ExamSubmission: TenantExamSubmission,
      Subject: TenantSubject,
      StaffUser: TenantStaffUser,
      Attendance: TenantAttendance,
      Branch: TenantBranch,
      Notification: TenantNotification,
      getBranchResultsModel
    }
  };

  tenantConnectionsMap[cleanTenantId] = context;
  console.log(`🏛️ Multi-Tenant Org DB Active: [${cleanTenantId}] -> DB [${dbName}] (Collections: exam_questions, [branch]_exam_results)`);

  return context;
};

export default getTenantContext;
