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
  getCollegeAnalytics,
  getStudentDossier
} from "../controllers/adminStudentController.js";
import {
  markAttendance,
  getAttendanceHistory,
  getStudentsForAttendance,
  getAttendanceReportSummary
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
  getExamSubmissionsReport,
  createExam,
  updateExam,
  deleteExam
} from "../controllers/adminExamController.js";
import {
  getCollegeIpPool,
  addCollegeIpPoolEntry,
  removeCollegeIpPoolEntry,
  toggleCollegeIpRestriction
} from "../controllers/adminIpPoolController.js";
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch
} from "../controllers/branchController.js";
import {
  getNotifications,
  createNotification,
  updateNotification,
  deleteNotification
} from "../controllers/notificationController.js";

const router = express.Router();

// Staff Authentication & Profile Routes
router.post("/staff/login", staffLogin);
router.get("/staff", getAllStaff);
router.post("/staff", createStaff);
router.put("/staff/:id", updateStaff);
router.delete("/staff/:id", deleteStaff);

// Student Management Routes (with Branch, Year, Section, Semester filters)
router.get("/students", getAllStudents);
router.get("/students/:id/dossier", getStudentDossier);
router.post("/students", createStudent);
router.put("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);

// Dedicated Database Collection for Branches / Departments
router.get("/branches", getBranches);
router.post("/branches", createBranch);
router.put("/branches/:id", updateBranch);
router.delete("/branches/:id", deleteBranch);

// Organization Updates & Notifications Routes
router.get("/notifications", getNotifications);
router.post("/notifications", createNotification);
router.put("/notifications/:id", updateNotification);
router.delete("/notifications/:id", deleteNotification);

// Attendance Management Routes
router.post("/attendance/mark", markAttendance);
router.get("/attendance/history", getAttendanceHistory);
router.get("/attendance/students", getStudentsForAttendance);
router.get("/attendance/report-summary", getAttendanceReportSummary);

// Separate Database Collection for Subjects List (for Period Attendance & Exams)
router.get("/subjects", getSubjects);
router.post("/subjects", createSubject);
router.put("/subjects/:id", updateSubject);
router.delete("/subjects/:id", deleteSubject);

// Examination Management CRUD Routes (Create, Read, Update, Delete Exams)
router.get("/exams", getAllExams);
router.get("/exams/:id/report", getExamSubmissionsReport);
router.get("/exams/:id", getExamById);
router.post("/exams", createExam);
router.put("/exams/:id", updateExam);
router.delete("/exams/:id", deleteExam);

// College Dashboard Executive Metrics
router.get("/analytics", getCollegeAnalytics);

// College Organization IP Pool & Examination Lockdown Security Routes
router.get("/ip-pool", getCollegeIpPool);
router.post("/ip-pool", addCollegeIpPoolEntry);
router.delete("/ip-pool/:ipId", removeCollegeIpPoolEntry);
router.put("/ip-pool/toggle", toggleCollegeIpRestriction);

export default router;
