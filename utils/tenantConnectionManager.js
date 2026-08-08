import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Map of cached tenant connections & models
const tenantConnectionsMap = {};

/**
 * Resolves a tenant-specific Mongoose database connection and models.
 * @param {string} tenantId - Organization identifier (e.g. 'jntuk', 'aits', 'kluniv')
 * @returns {object} { connection, models: { User, CourseEnrollment } }
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
    // If main connection is not yet ready, use current mongoose models as fallback
    return {
      connection: mongoose.connection,
      models: {
        User: mongoose.models.User,
        CourseEnrollment: mongoose.models.CourseEnrollment
      }
    };
  }

  // Create isolated database context using useDb
  const tenantDb = baseConn.useDb(dbName, { useCache: true });

  // Bind Schemas to tenant database connection
  const userSchema = mongoose.models.User?.schema || new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    branch: String,
    fullname: String,
    role: { type: String, default: "student" }
  });

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

  const TenantUser = tenantDb.model("User", userSchema, "stu_database");
  const TenantCourseEnrollment = tenantDb.model("CourseEnrollment", courseEnrollmentSchema, "course_enrollments");

  const context = {
    tenantId: cleanTenantId,
    dbName,
    connection: tenantDb,
    models: {
      User: TenantUser,
      CourseEnrollment: TenantCourseEnrollment
    }
  };

  tenantConnectionsMap[cleanTenantId] = context;
  console.log(`🏛️ Established isolated Multi-Tenant DB Connection for college organization: [${cleanTenantId}] -> DB [${dbName}]`);

  return context;
};
