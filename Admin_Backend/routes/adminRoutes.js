import express from "express";
import {
  staffLogin,
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff
} from "../controllers/staffController.js";
import {
  getAllStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getCollegeAnalytics
} from "../controllers/adminStudentController.js";
import {
  markAttendance,
  getAttendanceHistory,
  getStudentsForAttendance
} from "../controllers/attendanceController.js";
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject
} from "../controllers/subjectController.js";
import {
  getAllExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam
} from "../controllers/adminExamController.js";

const router = express.Router();

// Staff Authentication & Profile Routes
router.post("/staff/login", staffLogin);
router.get("/staff", getAllStaff);
router.post("/staff", createStaff);
router.put("/staff/:id", updateStaff);
router.delete("/staff/:id", deleteStaff);

// Student Management Routes (with Branch, Year, Section, Semester filters)
router.get("/students", getAllStudents);
router.post("/students", createStudent);
router.put("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);

// Attendance Management Routes
router.post("/attendance/mark", markAttendance);
router.get("/attendance/history", getAttendanceHistory);
router.get("/attendance/students", getStudentsForAttendance);

// Separate Database Collection for Subjects List (for Period Attendance & Exams)
router.get("/subjects", getSubjects);
router.post("/subjects", createSubject);
router.put("/subjects/:id", updateSubject);
router.delete("/subjects/:id", deleteSubject);

// Examination Management CRUD Routes (Create, Read, Update, Delete Exams)
router.get("/exams", getAllExams);
router.get("/exams/:id", getExamById);
router.post("/exams", createExam);
router.put("/exams/:id", updateExam);
router.delete("/exams/:id", deleteExam);

// College Dashboard Executive Metrics
router.get("/analytics", getCollegeAnalytics);

export default router;
