import mongoose from "mongoose";
import User from "../../models/User.js";
import StaffUser from "../models/StaffUser.js";
import Attendance from "../models/Attendance.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";
import getSuperAdminDb from "../../super_admin_backend/utils/superAdminDb.js";
import { getStudentBranchExamHistory } from "../../utils/resultsDbManager.js";

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

// Helper to search and aggregate exam submissions for a student across all DB models & collections
const fetchStudentExamSubmissions = async (tenantCtx, student, orgId) => {
  const allSubmissions = [];
  const seenIds = new Set();

  const rRoll = (student.rollNumber || "").trim();
  const rEmail = (student.email || "").trim();
  const rId = (student.id || "").toString().trim();

  const filterConditions = [];
  if (rRoll) {
    filterConditions.push({ userId: new RegExp(`^${rRoll}$`, "i") });
    filterConditions.push({ studentEmail: new RegExp(`^${rRoll}$`, "i") });
  }
  if (rEmail) {
    filterConditions.push({ userId: new RegExp(`^${rEmail}$`, "i") });
    filterConditions.push({ studentEmail: new RegExp(`^${rEmail}$`, "i") });
  }
  if (rId) {
    filterConditions.push({ userId: rId });
  }

  if (filterConditions.length === 0) return [];

  const flexFilter = { $or: filterConditions };
  const knownBranches = ["cse", "ece", "eee", "mech", "civil", "it", "aiml"];

  // 1. Search in tenant DB branch collections ('wb_org_[orgId]' -> '[branch]_exam_results')
  if (tenantCtx && tenantCtx.models && tenantCtx.models.getBranchResultsModel) {
    for (const b of knownBranches) {
      try {
        const Model = tenantCtx.models.getBranchResultsModel(b);
        if (Model) {
          const docs = await Model.find(flexFilter).sort({ submittedAt: -1 }).lean();
          (docs || []).forEach((d) => {
            const key = (d._id || d.examId || `${d.userId}_${d.examTitle}`).toString();
            if (key && !seenIds.has(key)) {
              seenIds.add(key);
              allSubmissions.push(d);
            }
          });
        }
      } catch (e) {}
    }
  }

  // 2. Search in tenant DB general 'exam_submissions' collection
  if (tenantCtx && tenantCtx.models && tenantCtx.models.ExamSubmission) {
    try {
      const docs = await tenantCtx.models.ExamSubmission.find(flexFilter).sort({ submittedAt: -1 }).lean();
      (docs || []).forEach((d) => {
        const key = (d._id || d.examId || `${d.userId}_${d.examTitle}`).toString();
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          allSubmissions.push(d);
        }
      });
    } catch (e) {}
  }

  // 3. Search in dedicated Results DB ('wb_results_db' -> '[branch]_exam_results')
  try {
    const resultsDocs = await getStudentBranchExamHistory(rRoll || rEmail || rId, student.branch);
    (resultsDocs || []).forEach((d) => {
      const obj = d.toObject ? d.toObject() : d;
      const key = (obj._id || obj.examId || `${obj.userId}_${obj.examTitle}`).toString();
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        allSubmissions.push(obj);
      }
    });
  } catch (e) {}

  return allSubmissions;
};

// Fetch Complete Comprehensive Student Master Dossier (Profile, Attendance Report, Exam Data)
export const getStudentDossier = async (req, res) => {
  try {
    const { id } = req.params;
    const TenantUser = getTenantUserModel(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";
    const tenantCtx = getTenantContext(orgId);

    // 1. Find Student Record
    const studentDoc = await TenantUser.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { username: id.toString().toUpperCase() }
      ]
    }).select("-password");

    if (!studentDoc) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    const student = {
      id: studentDoc._id,
      rollNumber: studentDoc.username,
      fullname: studentDoc.fullname || studentDoc.username,
      email: studentDoc.email,
      phone: studentDoc.phone || "Not Provided",
      gender: studentDoc.gender || "Not Specified",
      branch: (studentDoc.branch || "CSE").toUpperCase(),
      department: (studentDoc.branch || "CSE").toUpperCase(),
      year: studentDoc.year || 3,
      semester: studentDoc.semester || 1,
      section: studentDoc.section || "A",
      orgId: studentDoc.orgId || orgId,
      admissionYear: studentDoc.createdAt ? new Date(studentDoc.createdAt).getFullYear() : 2023,
      status: "Active / Good Standing"
    };

    // 2. Fetch Master Org Details for Branding
    let orgDetails = {
      name: "SV College of Engineering",
      code: "SVCK",
      logo: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80"
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
          logo: masterOrg.logo || orgDetails.logo
        };
      }
    } catch (e) {}

    // 3. Fetch Attendance History for Student directly from MongoDB
    let attendanceSummary = {
      totalClassesHeld: 0,
      totalAttended: 0,
      overallPercentage: "0.0%",
      status: "No Attendance Logged",
      subjectWise: []
    };

    try {
      const AttendanceModel = tenantCtx.models.Attendance;
      if (AttendanceModel) {
        const attFilter = {
          department: new RegExp(`^${student.branch}$`, "i"),
          year: student.year,
          section: student.section
        };
        if (req.query.subjectCode && req.query.subjectCode !== "all") {
          attFilter.subjectCode = req.query.subjectCode;
        }

        const records = await AttendanceModel.find(attFilter).sort({ date: -1 });

        if (records && records.length > 0) {
          let held = 0;
          let present = 0;
          const subjectMap = {};
          const monthMap = {};
          const dayWiseList = [];

          records.forEach((r) => {
            let isPresent = false;
            let isFoundInClass = false;

            // Check records array (contains { rollNumber, studentId, status: "present" | "absent" })
            if (r.records && Array.isArray(r.records) && r.records.length > 0) {
              const matchedRec = r.records.find(
                (rec) =>
                  (rec.rollNumber && rec.rollNumber.toUpperCase() === student.rollNumber.toUpperCase()) ||
                  (rec.studentId && rec.studentId.toString().toUpperCase() === student.rollNumber.toUpperCase())
              );
              if (matchedRec) {
                isFoundInClass = true;
                isPresent = (matchedRec.status || "").toLowerCase() === "present";
              }
            }

            // Check studentsPresent array (legacy format)
            if (!isFoundInClass && r.studentsPresent && Array.isArray(r.studentsPresent)) {
              isPresent = r.studentsPresent.some(
                (sRoll) => (sRoll || "").toUpperCase() === student.rollNumber.toUpperCase()
              );
              isFoundInClass = true;
            }

            if (isFoundInClass) {
              held++;
              if (isPresent) present++;

              const subj = r.subjectName || r.subjectCode || r.subject || "General Academic";
              if (!subjectMap[subj]) subjectMap[subj] = { total: 0, attended: 0, absent: 0 };
              subjectMap[subj].total++;
              if (isPresent) {
                subjectMap[subj].attended++;
              } else {
                subjectMap[subj].absent++;
              }

              // Day-Wise Log
              const rawDateStr = r.date || new Date().toISOString().split("T")[0];
              dayWiseList.push({
                id: r._id,
                date: rawDateStr,
                formattedDate: r.date ? new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : rawDateStr,
                subject: subj,
                subjectCode: r.subjectCode || "SUB",
                facultyName: r.facultyName || "Faculty",
                periods: r.periods || [1],
                status: isPresent ? "present" : "absent"
              });

              // Month-Wise Log
              const monthKey = r.date
                ? new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long" })
                : "Current Month";
              
              if (!monthMap[monthKey]) monthMap[monthKey] = { month: monthKey, total: 0, attended: 0, absent: 0 };
              monthMap[monthKey].total++;
              if (isPresent) {
                monthMap[monthKey].attended++;
              } else {
                monthMap[monthKey].absent++;
              }
            }
          });

          const pct = held > 0 ? ((present / held) * 100).toFixed(1) : "0.0";
          
          const monthWiseList = Object.keys(monthMap).map((mKey) => {
            const mData = monthMap[mKey];
            const mPct = mData.total > 0 ? ((mData.attended / mData.total) * 100).toFixed(1) : "0.0";
            return {
              month: mData.month,
              total: mData.total,
              attended: mData.attended,
              absent: mData.absent,
              percentage: `${mPct}%`,
              status: Number(mPct) >= 75 ? "Eligible" : Number(mPct) >= 65 ? "Condonation" : "Shortage"
            };
          });

          attendanceSummary = {
            totalClassesHeld: held,
            totalAttended: present,
            totalAbsent: held - present,
            overallPercentage: `${pct}%`,
            status: Number(pct) >= 75 ? "Sufficient (Eligible)" : Number(pct) >= 65 ? "Condonation Needed" : "Shortage (Ineligible)",
            subjectWise: Object.keys(subjectMap).map((subj) => {
              const sTotal = subjectMap[subj].total;
              const sAttended = subjectMap[subj].attended;
              const sAbsent = subjectMap[subj].absent;
              const sPct = sTotal > 0 ? ((sAttended / sTotal) * 100).toFixed(1) : "0.0";
              return {
                subject: subj,
                total: sTotal,
                attended: sAttended,
                absent: sAbsent,
                percentage: `${sPct}%`,
                status: Number(sPct) >= 75 ? "Eligible" : Number(sPct) >= 65 ? "Condonation" : "Shortage"
              };
            }),
            monthWise: monthWiseList,
            dayWise: dayWiseList
          };
        }
      }
    } catch (e) {
      console.error("Attendance query error:", e);
    }

    // 4. Fetch Real Exam Results for Student across ALL Collections & Results DB
    let examSummary = {
      totalAttempted: 0,
      passedCount: 0,
      failedCount: 0,
      averagePercentage: "0.0%",
      overallGrade: "N/A",
      examResults: []
    };

    try {
      const results = await fetchStudentExamSubmissions(tenantCtx, student, orgId);

      if (results && results.length > 0) {
        let totalObtained = 0;
        let totalMax = 0;
        let passed = 0;

        const formattedResults = results.map((r) => {
          const obtained = Number(r.score !== undefined ? r.score : (r.marksObtained || 0));
          const total = Number(r.totalMarks || 20);
          const pct = Number(r.percentage !== undefined ? r.percentage : (total > 0 ? (obtained / total) * 100 : 0));
          const isPassed = r.passed !== undefined ? r.passed : (pct >= 40);
          if (isPassed) passed++;

          totalObtained += obtained;
          totalMax += total;

          let grade = r.grade || "F";
          if (!r.grade) {
            if (pct >= 90) grade = "A+";
            else if (pct >= 80) grade = "A";
            else if (pct >= 70) grade = "B";
            else if (pct >= 60) grade = "C";
            else if (pct >= 40) grade = "D";
          }

          return {
            examTitle: r.examTitle || r.title || "Subject Assessment Exam",
            examCode: r.examId || r.code || "EXAM",
            subject: r.branch ? `${r.branch.toUpperCase()} Exam` : (r.subject || "Core Subject"),
            marksObtained: obtained,
            totalMarks: total,
            percentage: `${pct.toFixed(1)}%`,
            grade,
            result: isPassed ? "PASSED" : "FAILED",
            date: r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : new Date().toLocaleDateString()
          };
        });

        const avgPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "0.0";
        let overallGrade = "N/A";
        if (Number(avgPct) >= 90) overallGrade = "A+ (Distinction)";
        else if (Number(avgPct) >= 80) overallGrade = "A (First Class)";
        else if (Number(avgPct) >= 70) overallGrade = "B (Second Class)";
        else if (Number(avgPct) >= 40) overallGrade = "C (Pass)";
        else if (results.length > 0) overallGrade = "F (Needs Improvement)";

        examSummary = {
          totalAttempted: results.length,
          passedCount: passed,
          failedCount: results.length - passed,
          averagePercentage: `${avgPct}%`,
          overallGrade,
          examResults: formattedResults
        };
      }
    } catch (e) {
      console.error("Exam results query error:", e);
    }

    res.status(200).json({
      success: true,
      dossier: {
        student,
        orgDetails,
        attendanceSummary,
        examSummary,
        documentMeta: {
          generatedAt: new Date().toLocaleString(),
          documentId: `DOC-${student.rollNumber}-${Date.now().toString().slice(-6)}`,
          verificationUrl: `https://workbench.edu/verify/${student.rollNumber}`
        }
      }
    });
  } catch (error) {
    console.error("Error generating student dossier:", error);
    res.status(500).json({ success: false, message: "Server error generating student dossier report" });
  }
};
