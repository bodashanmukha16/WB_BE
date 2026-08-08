import CourseEnrollment from "../models/CourseEnrollment.js";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";

// Helper to get active tenant Mongoose model
const getTargetModel = (req) => req.tenantModels?.CourseEnrollment || CourseEnrollment;

// Helper to construct flexible student matching query (by email OR username/roll number)
const buildStudentQuery = (identifier) => {
  if (!identifier) return {};
  const clean = identifier.toString().trim();
  return {
    $or: [
      { studentEmail: { $regex: new RegExp(`^${clean}$`, "i") } },
      { userId: { $regex: new RegExp(`^${clean}$`, "i") } }
    ]
  };
};

// Enroll a student in a course
export const enrollCourse = async (req, res) => {
  try {
    const TargetModel = getTargetModel(req);
    const { userId, studentEmail, studentName, courseId, courseTitle } = req.body;

    const identifier = studentEmail || userId;
    if (!identifier || !courseId || !courseTitle) {
      return res.status(400).json({
        success: false,
        message: "Student identifier, courseId, and courseTitle are required."
      });
    }

    const searchQuery = {
      $and: [
        buildStudentQuery(identifier),
        { courseId }
      ]
    };

    let existingEnrollment = await TargetModel.findOne(searchQuery);

    if (existingEnrollment) {
      existingEnrollment.lastAccessedAt = new Date();
      await existingEnrollment.save();
      return res.status(200).json({
        success: true,
        message: "Already enrolled in this course.",
        tenantId: req.tenantId || "default",
        enrollment: existingEnrollment
      });
    }

    const newEnrollment = new TargetModel({
      userId: userId || identifier,
      studentEmail: studentEmail || identifier,
      studentName: studentName || identifier,
      courseId,
      courseTitle,
      enrolledAt: new Date(),
      status: "Enrolled",
      completedTopics: [],
      progressPercentage: 0,
      lastAccessedAt: new Date()
    });

    await newEnrollment.save();

    console.log(`✅ Student [${identifier}] enrolled in [${courseId}] -> DB [${req.dbName}]`);

    return res.status(201).json({
      success: true,
      message: "Successfully enrolled in course!",
      tenantId: req.tenantId || "default",
      enrollment: newEnrollment
    });
  } catch (error) {
    console.error("Error enrolling in course:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during course enrollment.",
      error: error.message
    });
  }
};

// Update course topic progress and completion
export const updateProgress = async (req, res) => {
  try {
    const TargetModel = getTargetModel(req);
    const { studentEmail, userId, courseId, completedTopics = [], totalTopics = 1 } = req.body;

    const identifier = studentEmail || userId;
    if (!identifier || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Student identifier and courseId are required."
      });
    }

    const searchQuery = {
      $and: [
        buildStudentQuery(identifier),
        { courseId }
      ]
    };

    let enrollment = await TargetModel.findOne(searchQuery);

    if (!enrollment) {
      // Search fallback across all tenant DBs if not found in current TargetModel
      const orgList = ["jntuk", "aits"];
      for (const orgId of orgList) {
        const ctx = getTenantContext(orgId);
        enrollment = await ctx.models.CourseEnrollment.findOne(searchQuery);
        if (enrollment) break;
      }
    }

    const total = Math.max(totalTopics, 1);
    const progress = Math.min(100, Math.round((completedTopics.length / total) * 100));

    if (!enrollment) {
      // Create new record if still missing
      enrollment = new TargetModel({
        userId: userId || identifier,
        studentEmail: studentEmail || identifier,
        studentName: identifier,
        courseId,
        courseTitle: "Course",
        enrolledAt: new Date(),
        status: progress === 100 ? "Completed" : "In-Progress",
        completedTopics,
        progressPercentage: progress,
        lastAccessedAt: new Date()
      });
    } else {
      enrollment.completedTopics = completedTopics;
      enrollment.progressPercentage = progress;
      enrollment.lastAccessedAt = new Date();

      if (progress === 100) {
        enrollment.status = "Completed";
        if (!enrollment.completionDate) {
          enrollment.completionDate = new Date();
        }
      } else if (progress > 0) {
        enrollment.status = "In-Progress";
      } else {
        enrollment.status = "Enrolled";
      }
    }

    await enrollment.save();

    console.log(`✅ Student [${identifier}] progress updated for [${courseId}]: ${progress}% (${completedTopics.length} topics done) -> DB [${req.dbName}]`);

    return res.status(200).json({
      success: true,
      message: "Course progress updated successfully.",
      tenantId: req.tenantId || "default",
      enrollment
    });
  } catch (error) {
    console.error("Error updating progress:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during progress update.",
      error: error.message
    });
  }
};

// Get all course enrollments for a specific student in college organization DB
export const getUserEnrollments = async (req, res) => {
  try {
    const TargetModel = getTargetModel(req);
    const { studentEmail } = req.params;

    if (!studentEmail) {
      return res.status(400).json({
        success: false,
        message: "studentEmail parameter is required."
      });
    }

    const searchQuery = buildStudentQuery(studentEmail);
    let enrollments = await TargetModel.find(searchQuery).sort({ lastAccessedAt: -1 });

    // Universal fallback search across all org DBs if 0 records found in TargetModel
    if ((!enrollments || enrollments.length === 0) && TargetModel !== CourseEnrollment) {
      const orgList = ["jntuk", "aits"];
      for (const orgId of orgList) {
        const ctx = getTenantContext(orgId);
        const records = await ctx.models.CourseEnrollment.find(searchQuery).sort({ lastAccessedAt: -1 });
        if (records && records.length > 0) {
          enrollments = records;
          break;
        }
      }
    }

    return res.status(200).json({
      success: true,
      tenantId: req.tenantId || "default",
      count: enrollments.length,
      enrollments
    });
  } catch (error) {
    console.error("Error fetching user enrollments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching enrollments.",
      error: error.message
    });
  }
};

// Get all student enrollment records and completion statistics for active tenant
export const getCourseEnrollmentStats = async (req, res) => {
  try {
    const TargetModel = getTargetModel(req);
    const enrollments = await TargetModel.find().sort({ createdAt: -1 });

    const totalEnrollments = enrollments.length;
    const completedCount = enrollments.filter((e) => e.status === "Completed").length;
    const inProgressCount = enrollments.filter((e) => e.status === "In-Progress").length;

    return res.status(200).json({
      success: true,
      tenantId: req.tenantId || "default",
      stats: {
        totalEnrollments,
        completedCount,
        inProgressCount
      },
      records: enrollments
    });
  } catch (error) {
    console.error("Error fetching enrollment stats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching stats.",
      error: error.message
    });
  }
};
