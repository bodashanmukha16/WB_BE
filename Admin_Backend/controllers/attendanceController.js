import Attendance from "../models/Attendance.js";
import User from "../../models/User.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";

// Helper to resolve physical tenant Attendance & User models for current organization
const getTenantModels = (req) => {
  const orgId = req.headers["x-tenant-id"] || req.tenantId || "jntuk";
  const ctx = getTenantContext(orgId);
  return {
    Attendance: req.tenantModels?.Attendance || ctx.models.Attendance,
    User: req.tenantModels?.User || ctx.models.User
  };
};

// Mark Class Attendance for a period (Lecturers / HOD / Admin) -> Saves physically in wb_org_[orgId].attendance_records
export const markAttendance = async (req, res) => {
  try {
    const {
      department,
      year,
      semester,
      section,
      subjectCode,
      subjectName,
      facultyId,
      facultyName,
      date,
      periods,
      records
    } = req.body;

    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "jntuk").toLowerCase().trim();
    const { Attendance: TenantAttendance } = getTenantModels(req);

    if (!department || !subjectCode || !facultyId || !date || !records) {
      return res.status(400).json({ success: false, message: "Required attendance details are missing" });
    }

    // Check if attendance for this exact class, date, subject, and period already logged in physical Org DB
    const existing = await TenantAttendance.findOne({
      department: department.toLowerCase(),
      year: Number(year || 1),
      section: section || "A",
      subjectCode,
      date,
      periods: { $in: periods || [1] }
    });

    if (existing) {
      // Update existing period record
      existing.records = records;
      await existing.save();

      // Also sync to global model fallback
      try {
        await Attendance.updateOne(
          { _id: existing._id },
          { $set: { records, markedAt: new Date() } }
        );
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: `Attendance updated for ${subjectCode} (${department.toUpperCase()}) - Periods [${(periods || [1]).join(", ")}] in Org DB [wb_org_${orgId}]`,
        attendance: existing
      });
    }

    // Create new attendance record physically in wb_org_[orgId].attendance_records
    const attendanceDoc = new TenantAttendance({
      department: department.toLowerCase(),
      year: Number(year || 1),
      semester: Number(semester || 1),
      section: section || "A",
      subjectCode,
      subjectName,
      facultyId,
      facultyName: facultyName || "Faculty",
      date,
      periods: periods || [1],
      records,
      orgId
    });

    await attendanceDoc.save();

    // Also sync to global Attendance model fallback
    try {
      const globalDoc = new Attendance({
        department: department.toLowerCase(),
        year: Number(year || 1),
        semester: Number(semester || 1),
        section: section || "A",
        subjectCode,
        subjectName,
        facultyId,
        facultyName: facultyName || "Faculty",
        date,
        periods: periods || [1],
        records,
        orgId
      });
      await globalDoc.save();
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Attendance successfully logged for ${subjectCode} (${department.toUpperCase()}) - Periods [${(periods || [1]).join(", ")}] in Org DB [wb_org_${orgId}]`,
      attendance: attendanceDoc
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ success: false, message: "Server error logging attendance" });
  }
};

// Get Attendance History & Reports from physical tenant Org DB (wb_org_[orgId].attendance_records)
export const getAttendanceHistory = async (req, res) => {
  try {
    const { department, year, section, subjectCode, date } = req.query;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "jntuk").toLowerCase().trim();
    const { Attendance: TenantAttendance } = getTenantModels(req);

    const filter = {};

    if (department && department !== "all") {
      filter.department = department.toLowerCase();
    }
    if (year) filter.year = Number(year);
    if (section) filter.section = section;
    if (subjectCode) filter.subjectCode = subjectCode;
    if (date) filter.date = date;

    let history = await TenantAttendance.find(filter).sort({ date: -1, createdAt: -1 });

    if (history.length === 0) {
      filter.orgId = orgId;
      history = await Attendance.find(filter).sort({ date: -1, createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      count: history.length,
      attendance: history
    });
  } catch (error) {
    console.error("Error fetching attendance history:", error);
    res.status(500).json({ success: false, message: "Server error fetching attendance logs" });
  }
};

// Get Students List for Attendance Marking by Class (STRICT Year, Branch, Section filtering from wb_org_[orgId].stu_database)
export const getStudentsForAttendance = async (req, res) => {
  try {
    const { department, year, section } = req.query;
    const { User: TenantUser } = getTenantModels(req);
    const filter = { role: "student" };

    if (department && department !== "all") {
      filter.branch = new RegExp(`^${department.trim()}$`, "i");
    }

    if (year) {
      filter.year = Number(year);
    }

    if (section && section !== "all") {
      filter.section = section.trim();
    }

    // Query physical tenant org DB wb_org_[orgId].stu_database with strict Year & Branch filters
    const students = await TenantUser.find(filter).select("username fullname email branch year semester section").sort({ username: 1 });

    res.status(200).json({
      success: true,
      count: students.length,
      students: students.map((s) => ({
        studentId: s._id,
        rollNumber: s.username,
        studentName: s.fullname || s.username,
        email: s.email,
        branch: s.branch || "CSE",
        year: s.year,
        semester: s.semester || 1,
        section: s.section || "A",
        status: "present" // Default status in UI
      }))
    });
  } catch (error) {
    console.error("Error fetching students for attendance:", error);
    res.status(500).json({ success: false, message: "Server error fetching students" });
  }
};
