import User from "../../models/User.js";
import StaffUser from "../models/StaffUser.js";
import Attendance from "../models/Attendance.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";

// Helper to resolve active organization tenant database model
const getTenantUserModel = (req) => {
  if (req.tenantModels && req.tenantModels.User) {
    return req.tenantModels.User;
  }
  const orgId = req.headers["x-tenant-id"] || req.tenantId || "jntuk";
  return getTenantContext(orgId).models.User;
};

// Fetch All Students (Enforcing HOD / Lecturer Department Scoping)
export const getAllStudents = async (req, res) => {
  try {
    const { department, year, section, search } = req.query;
    const TenantUser = getTenantUserModel(req);

    const filter = { role: "student" };

    let targetDept = department;
    const staffRole = req.staffUser?.role || req.user?.role;
    const staffDept = req.staffUser?.department || req.user?.department;

    if ((staffRole === "hod" || staffRole === "lecturer") && staffDept && staffDept !== "all") {
      targetDept = staffDept;
    }

    if (targetDept && targetDept !== "all") {
      filter.branch = new RegExp(`^${targetDept.trim()}$`, "i");
    }

    if (year) {
      filter.year = Number(year);
    }

    if (section && section !== "all") {
      filter.section = section;
    }

    if (search) {
      filter.$or = [
        { fullname: new RegExp(search, "i") },
        { username: new RegExp(search, "i") },
        { email: new RegExp(search, "i") }
      ];
    }

    const students = await TenantUser.find(filter).select("-password").sort({ username: 1 });

    res.status(200).json({
      success: true,
      count: students.length,
      orgId: req.tenantId || "jntuk",
      students: students.map((s) => ({
        id: s._id,
        rollNumber: s.username,
        fullname: s.fullname || s.username,
        email: s.email,
        branch: s.branch || "CSE",
        department: (s.branch || "CSE").toUpperCase(),
        year: s.year || 3,
        semester: s.semester || 1,
        section: s.section || "A",
        orgId: s.orgId || req.tenantId || "jntuk",
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ success: false, message: "Server error fetching student list" });
  }
};

// Create Student Record in active Organization Database
export const createStudent = async (req, res) => {
  try {
    const { rollNumber, fullname, email, password, branch, year, semester, section } = req.body;
    const TenantUser = getTenantUserModel(req);
    const orgId = req.tenantId || "jntuk";

    if (!rollNumber || !email) {
      return res.status(400).json({ success: false, message: "Roll Number and Email are required" });
    }

    const existing = await TenantUser.findOne({
      $or: [{ username: rollNumber.toUpperCase() }, { email: email.toLowerCase() }]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: `Student already exists in Org DB [wb_org_${orgId}]` });
    }

    const newStudent = new TenantUser({
      username: rollNumber.toUpperCase(),
      fullname,
      email: email.toLowerCase(),
      password: password || "Student@123",
      branch: branch || "CSE",
      year: Number(year || 3),
      semester: Number(semester || 1),
      section: section || "A",
      role: "student",
      orgId
    });

    await newStudent.save();

    res.status(201).json({
      success: true,
      message: `Student record created successfully in Org DB [wb_org_${orgId}]`,
      student: {
        id: newStudent._id,
        rollNumber: newStudent.username,
        fullname: newStudent.fullname,
        email: newStudent.email,
        branch: newStudent.branch,
        department: (newStudent.branch || "CSE").toUpperCase(),
        year: newStudent.year,
        semester: newStudent.semester,
        section: newStudent.section,
        orgId
      }
    });
  } catch (error) {
    console.error("Error creating student:", error);
    res.status(500).json({ success: false, message: "Server error creating student record" });
  }
};

// Update Student Record
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, email, branch, year, semester, section } = req.body;
    const TenantUser = getTenantUserModel(req);

    const updated = await TenantUser.findByIdAndUpdate(
      id,
      { fullname, email, branch, year, semester, section },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    res.status(200).json({
      success: true,
      message: "Student record updated successfully",
      student: updated
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ success: false, message: "Server error updating student record" });
  }
};

// Delete Student Record
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const TenantUser = getTenantUserModel(req);

    const deleted = await TenantUser.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    res.status(200).json({ success: true, message: "Student record deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ success: false, message: "Server error deleting student record" });
  }
};

// Executive College Dashboard Analytics Summary for Active Org
export const getCollegeAnalytics = async (req, res) => {
  try {
    const TenantUser = getTenantUserModel(req);
    const orgId = req.tenantId || "jntuk";

    const totalStudents = await TenantUser.countDocuments({ role: "student" });
    const totalStaff = await StaffUser.countDocuments({ $or: [{ orgId }, { department: "all" }] });

    const depts = ["cse", "ece", "eee", "mech", "civil"];
    const deptBreakdown = {};

    for (const d of depts) {
      const count = await TenantUser.countDocuments({ branch: new RegExp(d, "i") });
      deptBreakdown[d.toUpperCase()] = count || 0;
    }

    res.status(200).json({
      success: true,
      orgId,
      metrics: {
        totalStudents: totalStudents || 0,
        totalFaculty: totalStaff || 0,
        totalDepartments: 5,
        averageAttendance: "88.4%",
        averageExamPassRate: "92.6%",
        deptBreakdown
      }
    });
  } catch (error) {
    console.error("Error fetching college analytics:", error);
    res.status(500).json({ success: false, message: "Server error fetching analytics" });
  }
};
