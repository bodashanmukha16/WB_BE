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
  const userSchema = mongoose.models.User?.schema || new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    branch: String,
    fullname: String,
    role: { type: String, default: "student" }
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
  const examSchema = mongoose.models.Exam?.schema || new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    code: { type: String, required: true },
    orgId: { type: String, required: true },
    category: { type: String, default: "Mid-Term Examination" },
    durationMinutes: { type: Number, default: 30 },
    totalMarks: { type: Number, default: 20 },
    passPercentage: { type: Number, default: 40 },
    status: { type: String, default: "active" },
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

  const TenantUser = tenantDb.model("User", userSchema, "stu_database");
  const TenantCourseEnrollment = tenantDb.model("CourseEnrollment", courseEnrollmentSchema, "course_enrollments");
  const TenantExam = tenantDb.model("Exam", examSchema, "org_exams");
  const TenantExamQuestion = tenantDb.model("ExamQuestion", examQuestionSchema, "exam_questions");
  const TenantExamSubmission = tenantDb.model("ExamSubmission", examSubmissionSchema, "exam_submissions");

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
      getBranchResultsModel
    }
  };

  tenantConnectionsMap[cleanTenantId] = context;
  console.log(`🏛️ Multi-Tenant Org DB Active: [${cleanTenantId}] -> DB [${dbName}] (Collections: exam_questions, [branch]_exam_results)`);

  return context;
};

export default getTenantContext;
