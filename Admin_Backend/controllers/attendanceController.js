import Attendance from "../models/Attendance.js";
import User from "../../models/User.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";
import getSuperAdminDb from "../../super_admin_backend/utils/superAdminDb.js";

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

// Fetch Detailed Class Attendance Report Summary (Student Register + Analytics + Session Logs)
export const getAttendanceReportSummary = async (req, res) => {
  try {
    const { department, year, section, subjectCode } = req.query;
    const { Attendance: TenantAttendance, User: TenantUser } = getTenantModels(req);
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();

    let targetDept = department;
    const staffRole = req.staffUser?.role || req.user?.role;
    const staffDept = req.staffUser?.department || req.user?.department;

    if ((staffRole === "hod" || staffRole === "lecturer") && staffDept && staffDept !== "all") {
      targetDept = staffDept;
    }

    const studentFilter = { role: "student" };
    if (targetDept && targetDept !== "all") {
      studentFilter.branch = new RegExp(`^${targetDept.trim()}$`, "i");
    }
    if (year && year !== "all") {
      studentFilter.year = Number(year);
    }
    if (section && section !== "all") {
      studentFilter.section = section.trim();
    }

    // 1. Fetch Students
    const studentsDoc = await TenantUser.find(studentFilter)
      .select("username fullname email branch year semester section")
      .sort({ username: 1 });

    // 2. Fetch Attendance Logged Sessions for Class
    const attendanceFilter = {};
    if (targetDept && targetDept !== "all") {
      attendanceFilter.department = targetDept.toLowerCase();
    }
    if (year && year !== "all") attendanceFilter.year = Number(year);
    if (section && section !== "all") attendanceFilter.section = section;
    if (subjectCode && subjectCode !== "all") attendanceFilter.subjectCode = subjectCode;

    const sessions = await TenantAttendance.find(attendanceFilter).sort({ date: -1, createdAt: -1 });

    // 3. Process Attendance for each student
    let totalClasses = sessions.length;
    let totalEligibleCount = 0;
    let totalCondonationCount = 0;
    let totalShortageCount = 0;
    let cumulativePercentageSum = 0;

    const studentReports = studentsDoc.map((s) => {
      const sRoll = (s.username || "").toUpperCase();
      let attended = 0;
      let classesForStudent = 0;

      sessions.forEach((sess) => {
        let isPresent = false;
        let isFoundInClass = false;

        if (sess.records && Array.isArray(sess.records) && sess.records.length > 0) {
          const rec = sess.records.find(
            (r) =>
              (r.rollNumber && r.rollNumber.toUpperCase() === sRoll) ||
              (r.studentId && r.studentId.toString().toUpperCase() === sRoll)
          );
          if (rec) {
            isFoundInClass = true;
            isPresent = (rec.status || "").toLowerCase() === "present";
          }
        }

        if (!isFoundInClass && sess.studentsPresent && Array.isArray(sess.studentsPresent)) {
          isPresent = sess.studentsPresent.some((roll) => (roll || "").toUpperCase() === sRoll);
          isFoundInClass = true;
        }

        if (isFoundInClass) {
          classesForStudent++;
          if (isPresent) attended++;
        }
      });

      const pctNum = classesForStudent > 0 ? (attended / classesForStudent) * 100 : 0;
      const pct = pctNum.toFixed(1);

      let status = "Shortage";
      if (pctNum >= 75) {
        status = "Eligible";
        totalEligibleCount++;
      } else if (pctNum >= 65) {
        status = "Condonation";
        totalCondonationCount++;
      } else {
        totalShortageCount++;
      }

      cumulativePercentageSum += pctNum;

      return {
        studentId: s._id,
        rollNumber: s.username,
        fullname: s.fullname || s.username,
        email: s.email,
        branch: (s.branch || "CSE").toUpperCase(),
        year: s.year || 3,
        section: s.section || "A",
        totalClasses: classesForStudent,
        attended,
        absent: classesForStudent - attended,
        percentage: `${pct}%`,
        percentageNum: pctNum,
        status
      };
    });

    const avgPct = studentReports.length > 0 ? (cumulativePercentageSum / studentReports.length).toFixed(1) : "0.0";

    // 4. Fetch Master Org Details for Branding strictly from MongoDB OrganizationRegistry
    let orgDetails = {
      name: "SV College of Engineering",
      code: "SVCK",
      logo: ""
    };

    try {
      const { OrganizationRegistry } = getSuperAdminDb();
      const cleanOrgId = orgId.toLowerCase().trim();
      const orgRegex = new RegExp(`^${cleanOrgId}$`, 'i');
      const masterOrg = await OrganizationRegistry.findOne({
        $or: [
          { orgId: orgRegex },
          { code: orgRegex },
          { dbName: `wb_org_${cleanOrgId}` },
          { dbName: cleanOrgId }
        ]
      }).lean() || await OrganizationRegistry.findOne({}).lean();

      if (masterOrg) {
        orgDetails = {
          name: masterOrg.name || orgDetails.name,
          code: masterOrg.code || orgDetails.code,
          logo: masterOrg.logo || ""
        };
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      orgId,
      orgDetails,
      analytics: {
        totalStudents: studentReports.length,
        totalSessionsLogged: totalClasses,
        averageAttendancePct: `${avgPct}%`,
        eligibleCount: totalEligibleCount,
        condonationCount: totalCondonationCount,
        shortageCount: totalShortageCount
      },
      studentReports,
      sessions: sessions.map((sess) => ({
        id: sess._id,
        date: sess.date,
        subjectCode: sess.subjectCode,
        subjectName: sess.subjectName,
        facultyName: sess.facultyName,
        periods: sess.periods,
        department: sess.department?.toUpperCase() || "CSE",
        year: sess.year,
        section: sess.section,
        presentCount: (sess.records || []).filter((r) => (r.status || "").toLowerCase() === "present").length || (sess.studentsPresent || []).length,
        totalCount: (sess.records || []).length || (sess.studentsPresent || []).length
      }))
    });
  } catch (error) {
    console.error("Error generating attendance report summary:", error);
    res.status(500).json({ success: false, message: "Server error generating attendance report summary" });
  }
};
