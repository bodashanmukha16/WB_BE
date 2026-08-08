import express from "express";
import {
  enrollCourse,
  updateProgress,
  getUserEnrollments,
  getCourseEnrollmentStats
} from "../controllers/enrollmentController.js";

const router = express.Router();

// Route to enroll student in a course
router.post("/enroll", enrollCourse);

// Route to update student course topic progress & completion
router.post("/progress", updateProgress);

// Route to get all course enrollments for a specific student
router.get("/user/:studentEmail", getUserEnrollments);

// Route to get overall enrollment and completion stats
router.get("/stats", getCourseEnrollmentStats);

export default router;
