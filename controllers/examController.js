/**
 * Examination Controller for Organization-Specific Secure Exams
 * All data stored under the SAME Organization Database ('wb_org_[orgId]'):
 * 1) Questions Collection: 'exam_questions'
 * 2) Results Collections by Branch: 'cse_exam_results', 'ece_exam_results', 'eee_exam_results', 'mech_exam_results', 'civil_exam_results'
 */

import mongoose from "mongoose";
import resolveStudentBranch from "../utils/branchResolver.js";
import { getClientIp, getCandidateIps, isIpInPool } from "../utils/ipUtils.js";
import getSuperAdminDb from "../super_admin_backend/utils/superAdminDb.js";

/**
 * Detect client system IP
 */
export const getSystemIp = async (req, res) => {
  const candidateIps = getCandidateIps(req);
  res.status(200).json({
    success: true,
    ip: candidateIps[0] || '127.0.0.1',
    candidateIps
  });
};

/**
 * Verify if incoming student request IP is whitelisted in Org / Exam Allowed IP Pool
 */
export const verifyExamIp = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || "svck";
    const cleanOrgId = tenantId.toString().toLowerCase().trim();
    const candidateIps = getCandidateIps(req);
    const primaryIp = candidateIps.find(ip => ip !== '127.0.0.1') || candidateIps[0] || '127.0.0.1';
    const { Exam } = req.tenantModels || {};

    let isRestrictionEnabled = true;
    let allowedPool = [];

    // 1. Fetch Org-wise Whitelisted IP Pool directly from MongoDB (wb_super_admin -> organizations)
    try {
      const { OrganizationRegistry } = getSuperAdminDb();
      // Case-insensitive regex match for orgId, code, or dbName
      const orgRegex = new RegExp(`^${cleanOrgId}$`, 'i');
      const masterOrg = await OrganizationRegistry.findOne({
        $or: [
          { orgId: orgRegex },
          { code: orgRegex },
          { dbName: `wb_org_${cleanOrgId}` },
          { dbName: cleanOrgId }
        ]
      }) || await OrganizationRegistry.findOne({}); // Fallback to first org if only 1 org registered

      if (masterOrg) {
        if (masterOrg.isIpRestrictionEnabled === false) {
          isRestrictionEnabled = false;
        }
        if (masterOrg.allowedIpPool && masterOrg.allowedIpPool.length > 0) {
          allowedPool.push(...masterOrg.allowedIpPool);
        }
      }
    } catch (e) {
      console.error("Error querying Org IP Pool from MongoDB:", e);
    }

    // 2. Also check Exam-level IP Pool from tenant MongoDB if present
    if (Exam) {
      const examDoc = await findExamByIdOrCode(Exam, id);
      if (examDoc) {
        if (examDoc.isIpRestrictionEnabled === false) {
          isRestrictionEnabled = false;
        }
        if (examDoc.allowedIpPool && examDoc.allowedIpPool.length > 0) {
          allowedPool.push(...examDoc.allowedIpPool);
        }
      }
    }

    // If IP restriction is disabled for this organization, allow access
    if (!isRestrictionEnabled) {
      return res.status(200).json({
        success: true,
        accessGranted: true,
        ip: primaryIp,
        candidateIps,
        message: "IP restriction is currently disabled."
      });
    }

    // Strictly check if current IPv4 address is in the whitelisted IP Pool from MongoDB
    const accessGranted = isIpInPool(candidateIps, allowedPool);

    const dbIpList = allowedPool.map(item => (typeof item === 'string' ? item : item.ip));

    console.log(`\n============== 🔍 IP LOCKDOWN VERIFICATION VERDICT ==============`);
    console.log(`🏢 Organization ID         : ${cleanOrgId.toUpperCase()}`);
    console.log(`💻 Fetched System IPv4s    :`, candidateIps);
    console.log(`🗄️ MongoDB Whitelisted IPs :`, dbIpList);
    console.log(`🛡️ Lockdown Enforcement    : ${isRestrictionEnabled ? 'ACTIVE (ENABLED)' : 'DISABLED'}`);
    console.log(`🎯 Verification Result     : ${accessGranted ? '✅ ACCESS GRANTED (MATCH FOUND)' : '❌ ACCESS DENIED (NO MATCH FOUND)'}`);
    console.log(`=================================================================\n`);
    
    // Find matching IP item for display
    const matchedIpItem = allowedPool.find(item => {
      const rawEntry = (typeof item === 'string' ? item : item.ip || '').trim();
      return candidateIps.some(cIp => cIp === rawEntry || rawEntry === '*');
    });

    const displayIp = (typeof matchedIpItem === 'object' && matchedIpItem?.ip) ? matchedIpItem.ip : primaryIp;

    if (accessGranted) {
      return res.status(200).json({
        success: true,
        accessGranted: true,
        ip: displayIp,
        candidateIps,
        dbIpList,
        message: `Verified College Lab System (${displayIp}) Access Granted`
      });
    }

    return res.status(200).json({
      success: true,
      accessGranted: false,
      ip: primaryIp,
      candidateIps,
      dbIpList,
      allowedPoolCount: allowedPool.length,
      message: `Unauthorized System IP (${primaryIp}). Your IPv4 address is not registered in ${cleanOrgId.toUpperCase()}'s Whitelisted Lab IP Pool.`
    });
  } catch (error) {
    console.error("Error verifying exam IP:", error);
    res.status(500).json({ success: false, message: "Server error verifying system IP" });
  }
};

// Helper to safely find exam by ObjectId or String code/id
const findExamByIdOrCode = async (Exam, id) => {
  if (!Exam || !id) return null;
  // Try by code or id field first
  let doc = await Exam.findOne({ $or: [{ code: id }, { id: id }, { examId: id }] });
  if (doc) return doc;

  // Try by Mongo ObjectId if valid format
  if (mongoose.Types.ObjectId.isValid(id)) {
    doc = await Exam.findById(id);
  }
  return doc;
};

const getExamDept = (exam) => {
  if (exam.department && exam.department !== "all") {
    return exam.department.toLowerCase();
  }
  const str = `${exam.code || ""} ${exam.title || ""} ${exam.subject || ""}`.toUpperCase();
  if (str.includes("ECE") || str.includes("ELECTRONIC") || str.includes("VLSI") || str.includes("CIRCUIT")) {
    return "ece";
  }
  if (str.includes("EEE") || str.includes("ELECTRICAL") || str.includes("POWER")) {
    return "eee";
  }
  if (str.includes("MECH") || str.includes("MECHANICAL") || str.includes("THERMO") || str.includes("HEAT")) {
    return "mech";
  }
  if (str.includes("CIVIL") || str.includes("STRUCTURAL") || str.includes("HYDRAULIC")) {
    return "civil";
  }
  if (str.includes("CSE") || str.includes("COMPUTER") || str.includes("JAVA") || str.includes("DATA STRUCTURE")) {
    return "cse";
  }
  return "cse";
};

export const getOrgExams = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || "svck";
    const departmentQuery = req.query.department || req.query.branch || req.headers["x-user-branch"];
    const yearQuery = req.query.year || req.headers["x-user-year"];

    const { Exam, ExamQuestion } = req.tenantModels || {};
    let exams = [];
    if (Exam) {
      const rawExams = await Exam.find({}).sort({ createdAt: -1 });
      
      let cleanBranch = "all";
      if (departmentQuery && departmentQuery !== "all") {
        cleanBranch = resolveStudentBranch(departmentQuery);
      }

      for (const e of rawExams) {
        const obj = e.toObject ? e.toObject() : { ...e };
        const mongoIdStr = e._id ? e._id.toString() : "";
        const computedDept = getExamDept(obj);

        // Strictly filter by department if cleanBranch is specified and not 'all'
        if (cleanBranch !== "all") {
          if (computedDept !== cleanBranch && computedDept !== "all") {
            continue; // Exclude exams belonging to other departments!
          }
        }

        // Strictly filter by academic year if student year is specified
        if (yearQuery && yearQuery !== "all") {
          const targetYear = Number(yearQuery);
          const examYear = Number(obj.year || 3);
          if (examYear !== targetYear) {
            continue; // Exclude exams belonging to other academic years!
          }
        }

        obj.department = computedDept;
        let qCount = 0;
        if (ExamQuestion) {
          qCount = await ExamQuestion.countDocuments({
            $or: [{ examId: mongoIdStr }, { examId: e.code }, { examId: e.id }]
          });
        }
        
        obj.id = obj._id ? obj._id.toString() : obj.id;
        obj.questionsCount = qCount !== undefined ? qCount : (e.questions ? e.questions.length : 0);
        exams.push(obj);
      }
    }

    const responsePayload = {
      success: true,
      orgId: tenantId,
      count: exams.length,
      exams
    };

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching org exams:", error);
    res.status(500).json({ success: false, message: "Server error fetching exams" });
  }
};

export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || "svck";

    const { Exam, ExamQuestion } = req.tenantModels || {};

    if (!Exam) {
      return res.status(404).json({ success: false, message: "Exam model not found" });
    }

    const examDoc = await findExamByIdOrCode(Exam, id);
    if (!examDoc) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const examObj = examDoc.toObject ? examDoc.toObject() : { ...examDoc };
    examObj.id = examObj._id ? examObj._id.toString() : (examObj.id || id);

    // Fetch questions strictly belonging to this exam ID
    if (ExamQuestion) {
      const mongoIdStr = examDoc._id ? examDoc._id.toString() : id;
      const dbQuestions = await ExamQuestion.find({
        $or: [{ examId: mongoIdStr }, { examId: id }]
      }).sort({ questionId: 1, createdAt: 1 });

      if (dbQuestions && dbQuestions.length > 0) {
        examObj.questions = dbQuestions.map((q) => ({
          id: q._id ? q._id.toString() : (q.id || q.questionId),
          questionId: q.questionId || (q._id ? q._id.toString() : q.id),
          text: q.text,
          codeSnippet: q.codeSnippet || "",
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation || "",
          marks: q.marks || 2
        }));
        examObj.questionsCount = dbQuestions.length;
        examObj.totalMarks = dbQuestions.reduce((sum, q) => sum + Number(q.marks || 2), 0);
      }
    }

    const responsePayload = {
      success: true,
      exam: examObj
    };

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching exam details:", error);
    res.status(500).json({ success: false, message: "Server error fetching exam details" });
  }
};

export const submitExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, studentEmail, studentName, branch, studentBranch, department, answers, violationsCount, timeSpentSeconds } = req.body;
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || "svck";
    const { Exam, ExamQuestion, getBranchResultsModel } = req.tenantModels || {};

    if (!Exam) {
      return res.status(500).json({ success: false, message: "Tenant models not initialized" });
    }

    const examDoc = await findExamByIdOrCode(Exam, id);
    if (!examDoc) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const mongoIdStr = examDoc._id ? examDoc._id.toString() : id;

    // Fetch questions from 'exam_questions' collection under current Organization DB
    let questions = [];
    if (ExamQuestion) {
      questions = await ExamQuestion.find({
        $or: [{ examId: mongoIdStr }, { examId: id }]
      }).sort({ questionId: 1, createdAt: 1 });
    }

    if (!questions || questions.length === 0) {
      questions = examDoc.questions || [];
    }

    let score = 0;
    const totalMarks = examDoc.totalMarks || (questions.length * 2);

    questions.forEach((q) => {
      const mongoIdKey = q._id ? q._id.toString() : q.id;
      const customIdKey = q.questionId;
      const selectedOpt = answers[mongoIdKey] !== undefined 
        ? answers[mongoIdKey] 
        : (answers[customIdKey] !== undefined ? answers[customIdKey] : answers[q.id]);

      if (selectedOpt !== undefined && Number(selectedOpt) === Number(q.correctOptionIndex)) {
        score += (q.marks || 2);
      }
    });

    const percentage = Math.round((score / totalMarks) * 100);
    const passed = percentage >= (examDoc.passPercentage || 40);

    let grade = "F";
    if (percentage >= 90) grade = "S (Outstanding)";
    else if (percentage >= 80) grade = "A+ (Excellent)";
    else if (percentage >= 70) grade = "A (Very Good)";
    else if (percentage >= 60) grade = "B (Good)";
    else if (percentage >= 50) grade = "C (Satisfactory)";
    else if (percentage >= 40) grade = "D (Pass)";

    // Resolve student academic branch (e.g. 'cse', 'ece', 'eee', 'mech', 'civil')
    const rawBranchInput = branch || studentBranch || department || examDoc.department || userId || studentEmail;
    const resolvedBranch = resolveStudentBranch(rawBranchInput);

    // Resolve student Roll Number and Full Name from Tenant User DB
    const { User: TenantUser } = req.tenantModels || {};
    const resolvedRollNo = req.body.studentRollNo || req.body.rollNumber || req.body.rollNo || userId || "N/A";
    let resolvedName = studentName || req.body.name || req.body.fullname;

    if (!resolvedName || resolvedName === userId || resolvedName === resolvedRollNo) {
      if (TenantUser) {
        try {
          const uDoc = await TenantUser.findOne({
            $or: [{ username: userId }, { username: resolvedRollNo }, { email: studentEmail }]
          }).lean();
          if (uDoc && (uDoc.fullname || uDoc.name)) {
            resolvedName = uDoc.fullname || uDoc.name;
          }
        } catch (e) {}
      }
    }

    if (!resolvedName || resolvedName === resolvedRollNo) {
      if (studentEmail && studentEmail.includes("@")) {
        const emailUser = studentEmail.split("@")[0];
        if (emailUser.toLowerCase() !== resolvedRollNo.toLowerCase()) {
          resolvedName = emailUser.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        } else {
          resolvedName = `Student ${resolvedRollNo}`;
        }
      } else {
        resolvedName = `Student ${resolvedRollNo}`;
      }
    }

    const submissionPayload = {
      examId: mongoIdStr,
      examTitle: examDoc.title,
      userId: userId || "guest_user",
      studentRollNo: resolvedRollNo,
      studentEmail: studentEmail || "student@workbench.edu",
      studentName: resolvedName,
      branch: resolvedBranch,
      orgId: tenantId,
      score,
      totalMarks,
      percentage,
      grade,
      passed,
      violationsCount: violationsCount || 0,
      timeSpentSeconds: timeSpentSeconds || 0,
      answers,
      submittedAt: new Date()
    };

    // Save submission into branch-specific collection under Organization DB ('wb_org_[orgId]')
    // e.g., 'cse_exam_results', 'ece_exam_results', 'eee_exam_results'
    const BranchResultsModel = getBranchResultsModel(resolvedBranch);
    const branchSubmission = new BranchResultsModel(submissionPayload);
    const savedSubmission = await branchSubmission.save();

    console.log(`✅ Saved Exam Submission into Org DB [wb_org_${tenantId}] -> Collection [${resolvedBranch}_exam_results]`);

    res.status(200).json({
      success: true,
      message: `Examination submitted successfully to Org DB [wb_org_${tenantId}] under collection [${resolvedBranch}_exam_results]`,
      submission: savedSubmission
    });
  } catch (error) {
    console.error("Error submitting exam:", error);
    res.status(500).json({ success: false, message: "Server error submitting examination" });
  }
};

export const getExamHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { branch } = req.query;
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || "svck";
    const resolvedBranch = resolveStudentBranch(branch || userId);

    const { getBranchResultsModel } = req.tenantModels || {};
    let submissions = [];

    if (getBranchResultsModel) {
      const BranchResultsModel = getBranchResultsModel(resolvedBranch);
      submissions = await BranchResultsModel.find({ userId }).sort({ submittedAt: -1 });

      // Fallback search across all branch collections in org DB if needed
      if (!submissions || submissions.length === 0) {
        const branches = ["cse", "ece", "eee", "mech", "civil", "it", "aiml"];
        for (const b of branches) {
          if (b !== resolvedBranch) {
            const Model = getBranchResultsModel(b);
            const found = await Model.find({ userId }).sort({ submittedAt: -1 });
            if (found && found.length > 0) {
              submissions = found;
              break;
            }
          }
        }
      }
    }

    const responsePayload = {
      success: true,
      count: submissions.length,
      submissions
    };

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching exam history:", error);
    res.status(500).json({ success: false, message: "Server error fetching exam history" });
  }
};
