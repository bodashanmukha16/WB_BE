import CourseEnrollment from "../models/CourseEnrollment.js";

// Enroll a student in a course
export const enrollCourse = async (req, res) => {
  try {
    const { userId, studentEmail, studentName, courseId, courseTitle } = req.body;

    if (!studentEmail || !courseId || !courseTitle) {
      return res.status(400).json({
        success: false,
        message: "studentEmail, courseId, and courseTitle are required."
      });
    }

    const existingEnrollment = await CourseEnrollment.findOne({ studentEmail, courseId });

    if (existingEnrollment) {
      existingEnrollment.lastAccessedAt = new Date();
      await existingEnrollment.save();
      return res.status(200).json({
        success: true,
        message: "Already enrolled in this course.",
        enrollment: existingEnrollment
      });
    }

    const newEnrollment = new CourseEnrollment({
      userId: userId || studentEmail,
      studentEmail,
      studentName: studentName || "Student",
      courseId,
      courseTitle,
      enrolledAt: new Date(),
      status: "Enrolled",
      completedTopics: [],
      progressPercentage: 0,
      lastAccessedAt: new Date()
    });

    await newEnrollment.save();

    return res.status(201).json({
      success: true,
      message: "Successfully enrolled in course!",
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
    const { studentEmail, courseId, completedTopics = [], totalTopics = 1 } = req.body;

    if (!studentEmail || !courseId) {
      return res.status(400).json({
        success: false,
        message: "studentEmail and courseId are required."
      });
    }

    const enrollment = await CourseEnrollment.findOne({ studentEmail, courseId });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment record not found for this course."
      });
    }

    const total = Math.max(totalTopics, 1);
    const progress = Math.min(100, Math.round((completedTopics.length / total) * 100));

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

    await enrollment.save();

    return res.status(200).json({
      success: true,
      message: "Course progress updated successfully.",
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

// Get all course enrollments for a specific student
export const getUserEnrollments = async (req, res) => {
  try {
    const { studentEmail } = req.params;

    if (!studentEmail) {
      return res.status(400).json({
        success: false,
        message: "studentEmail parameter is required."
      });
    }

    const enrollments = await CourseEnrollment.find({ studentEmail }).sort({ lastAccessedAt: -1 });

    return res.status(200).json({
      success: true,
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

// Get all student enrollment records and completion statistics (data entry)
export const getCourseEnrollmentStats = async (req, res) => {
  try {
    const enrollments = await CourseEnrollment.find().sort({ createdAt: -1 });

    const totalEnrollments = enrollments.length;
    const completedCount = enrollments.filter((e) => e.status === "Completed").length;
    const inProgressCount = enrollments.filter((e) => e.status === "In-Progress").length;

    return res.status(200).json({
      success: true,
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
