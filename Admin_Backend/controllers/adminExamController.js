import getTenantContext from "../../utils/tenantConnectionManager.js";
import { getBranchResultsModel } from "../../utils/resultsDbManager.js";
import { getSuperAdminDb } from "../../super_admin_backend/utils/superAdminDb.js";
import { delPattern } from "../../config/cacheManager.js";

const getTenantExamModels = (req) => {
  if (req.tenantModels && req.tenantModels.Exam) {
    return {
      Exam: req.tenantModels.Exam,
      ExamQuestion: req.tenantModels.ExamQuestion
    };
  }
  const orgId = req.headers["x-tenant-id"] || req.tenantId || "svck";
  const ctx = getTenantContext(orgId);
  return {
    Exam: ctx.models.Exam,
    ExamQuestion: ctx.models.ExamQuestion
  };
};

// Fetch All Examinations (filtered by branch/department, year, status)
export const getAllExams = async (req, res) => {
  try {
    const { department, year, status } = req.query;
    const { Exam } = getTenantExamModels(req);
    const filter = {};

    if (department && department !== "all") {
      filter.department = department.toLowerCase();
    }
    if (year) {
      filter.year = Number(year);
    }
    if (status && status !== "all") {
      filter.status = status;
    }

    const exams = await Exam.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: exams.length,
      exams
    });
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ success: false, message: "Error fetching exams" });
  }
};

// Fetch Single Exam with Questions
export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const { Exam, ExamQuestion } = getTenantExamModels(req);

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const questions = await ExamQuestion.find({
      $or: [{ examId: id }, { examId: id.toString() }, { examId: exam.code }]
    }).sort({ questionId: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      exam: {
        ...exam.toObject(),
        questions
      }
    });
  } catch (error) {
    console.error("Error fetching exam details:", error);
    res.status(500).json({ success: false, message: "Error retrieving exam details" });
  }
};

// Create New Examination with Questions
export const createExam = async (req, res) => {
  try {
    const {
      title,
      code,
      subject,
      department,
      year,
      durationMinutes,
      totalMarks,
      passPercentage,
      instructions,
      questions
    } = req.body;

    const { Exam, ExamQuestion } = getTenantExamModels(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";

    if (!title || !code || !subject) {
      return res.status(400).json({ success: false, message: "Exam Title, Code, and Subject are required" });
    }

    const newExam = new Exam({
      title,
      code: code.toUpperCase(),
      subject,
      department: (department || "cse").toLowerCase(),
      year: Number(year || 3),
      durationMinutes: Number(durationMinutes || 30),
      totalMarks: Number(totalMarks || 20),
      passPercentage: Number(passPercentage || 40),
      instructions: instructions || ["No tab switching", "Camera enabled"],
      status: "active",
      orgId
    });

    await newExam.save();

    // If questions array provided, save exam questions
    if (questions && Array.isArray(questions) && questions.length > 0) {
      const questionDocs = questions.map((q, idx) => ({
        questionId: `Q${idx + 1}`,
        examId: newExam._id.toString(),
        orgId,
        subject,
        text: q.text,
        options: q.options || [],
        correctOptionIndex: Number(q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
        explanation: q.explanation || "",
        marks: Number(q.marks || 2)
      }));

      await ExamQuestion.insertMany(questionDocs);
    }

    // Invalidate Redis Exam Caches for this organization
    await delPattern(`org_exams:${orgId}:*`);
    await delPattern(`exam_details:${orgId}:*`);

    res.status(201).json({
      success: true,
      message: "Examination created successfully in Org DB",
      exam: newExam
    });
  } catch (error) {
    console.error("Error creating exam:", error);
    res.status(500).json({ success: false, message: "Error creating examination" });
  }
};

// Update Examination
export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { questions, ...updateData } = req.body;
    const { Exam, ExamQuestion } = getTenantExamModels(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";

    if (updateData.department) updateData.department = updateData.department.toLowerCase();
    if (updateData.year) updateData.year = Number(updateData.year);

    const updated = await Exam.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      await ExamQuestion.deleteMany({ examId: id });
      if (questions.length > 0) {
        const questionDocs = questions.map((q, idx) => ({
          questionId: `Q${idx + 1}`,
          examId: id,
          orgId,
          subject: updated.subject,
          text: q.text,
          options: q.options || [],
          correctOptionIndex: Number(q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
          explanation: q.explanation || "",
          marks: Number(q.marks || 2)
        }));
        await ExamQuestion.insertMany(questionDocs);
      }
    }

    // Invalidate Redis Exam Caches for this organization and specific exam
    await delPattern(`org_exams:${orgId}:*`);
    await delPattern(`exam_details:${orgId}:*`);

    res.status(200).json({
      success: true,
      message: "Examination updated successfully",
      exam: updated
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    res.status(500).json({ success: false, message: "Error updating examination" });
  }
};

// Delete Examination and associated Questions
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { Exam, ExamQuestion } = getTenantExamModels(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";

    const deleted = await Exam.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    await ExamQuestion.deleteMany({ examId: id });

    // Invalidate Redis Exam Caches for this organization and specific exam
    await delPattern(`org_exams:${orgId}:*`);
    await delPattern(`exam_details:${orgId}:*`);

    res.status(200).json({
      success: true,
      message: "Examination and associated questions deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting exam:", error);
    res.status(500).json({ success: false, message: "Error deleting examination" });
  }
};



// Fetch Organization Details dynamically from Master MongoDB OrganizationRegistry collection ('wb_super_admin.organizations')
const fetchOrgDetailsFromDb = async (targetOrgId) => {
  const cleanOrgId = (targetOrgId || "svck").toLowerCase().trim();
  try {
    const { OrganizationRegistry } = getSuperAdminDb();
    if (OrganizationRegistry) {
      const orgDoc = await OrganizationRegistry.findOne({
        $or: [
          { orgId: cleanOrgId },
          { code: cleanOrgId.toUpperCase() }
        ]
      }).lean();

      if (orgDoc) {
        return {
          orgId: orgDoc.orgId || cleanOrgId,
          name: orgDoc.name || `${cleanOrgId.toUpperCase()} College of Engineering`,
          code: orgDoc.code || cleanOrgId.toUpperCase(),
          logo: orgDoc.logo || "https://wb-fe.onrender.com/assets/logo-BWZqlPh4.png",
          tagline: orgDoc.tagline || "Approved by AICTE | Affiliated to State Technological University | Accredited Grade 'A+'",
          division: orgDoc.division || "OFFICE OF THE CONTROLLER OF EXAMINATIONS & ACADEMIC EVALUATION",
          address: orgDoc.address || "Institutional Campus",
          contactEmail: orgDoc.contactEmail || `admin@${cleanOrgId}.edu.in`
        };
      }
    }
  } catch (err) {
    console.warn("MongoDB OrganizationRegistry query notice:", err.message);
  }

  return {
    orgId: cleanOrgId,
    name: `${cleanOrgId.toUpperCase()} Institution of Technology`,
    code: cleanOrgId.toUpperCase(),
    logo: "https://wb-fe.onrender.com/assets/logo-BWZqlPh4.png",
    tagline: "Approved by AICTE | Affiliated to State Technological University | Accredited Grade 'A+'",
    division: "OFFICE OF THE CONTROLLER OF EXAMINATIONS & ACADEMIC EVALUATION",
    address: "Institutional Campus",
    contactEmail: `admin@${cleanOrgId}.edu.in`
  };
};

// Fetch Detailed Exam Responses & Submissions Report
export const getExamSubmissionsReport = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();
    const ctx = getTenantContext(orgId);

    const { Exam, ExamQuestion, ExamSubmission } = ctx.models;

    const exam = await Exam.findById(id).lean();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const questions = await ExamQuestion.find({
      $or: [{ examId: id }, { examId: id.toString() }, { examId: exam.code }]
    }).sort({ questionId: 1, createdAt: 1 }).lean();

    // Query exam_submissions across all branch collections and separate Results DB ('wb_results_db')
    const rawMatches = [];
    const branches = ["cse", "ece", "eee", "mech", "civil"];
    const idQuery = [
      { examId: id },
      { examId: id.toString() },
      { examId: exam.code },
      { examTitle: exam.title }
    ];

    // 1. Tenant DB ExamSubmission collection
    if (ExamSubmission) {
      try {
        const docs = await ExamSubmission.find({ $or: idQuery }).lean();
        rawMatches.push(...docs);
      } catch (e) {}
    }

    // 2. Tenant DB Branch-Specific Collections (e.g. cse_exam_results, ece_exam_results)
    if (ctx && ctx.models && typeof ctx.models.getBranchResultsModel === "function") {
      for (const b of branches) {
        try {
          const BM = ctx.models.getBranchResultsModel(b);
          const docs = await BM.find({ $or: idQuery }).lean();
          rawMatches.push(...docs);
        } catch (e) {}
      }
    }

    // 3. Dedicated Results Database ('wb_results_db') Branch Collections
    for (const b of branches) {
      try {
        const BM = getBranchResultsModel(b);
        const docs = await BM.find({ $or: idQuery }).lean();
        rawMatches.push(...docs);
      } catch (e) {}
    }

    // Deduplicate by unique submission _id or (userId + examId + submittedAt timestamp)
    const uniqueMap = new Map();
    rawMatches.forEach((s) => {
      const key = s._id ? s._id.toString() : `${s.userId}_${s.examId}_${new Date(s.submittedAt || Date.now()).getTime()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    });

    const submissions = Array.from(uniqueMap.values()).sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    // Fetch all student records from Tenant DB to map real Student Full Name & Roll Number
    const { User: TenantUser } = ctx.models;
    const studentDbMap = new Map();
    if (TenantUser) {
      try {
        const studentDocs = await TenantUser.find({}).select("username fullname name email").lean();
        studentDocs.forEach((u) => {
          const nameVal = u.fullname || u.name;
          if (nameVal) {
            if (u.username) studentDbMap.set(u.username.toLowerCase(), nameVal);
            if (u.email) studentDbMap.set(u.email.toLowerCase(), nameVal);
          }
        });
      } catch (e) {}
    }

    // Enrich each submission with actual student Roll Number and Full Name
    submissions.forEach((s) => {
      const rollNo = s.studentRollNo || s.rollNumber || s.rollNo || s.studentId || s.userId || "N/A";
      let name = s.studentName || s.fullname || s.name;

      if (!name || name === rollNo || name.toLowerCase().includes("candidate") || name.toLowerCase().includes("guest") || name.toLowerCase().includes("student candidate")) {
        const foundName = studentDbMap.get(rollNo.toLowerCase()) || (s.studentEmail ? studentDbMap.get(s.studentEmail.toLowerCase()) : null);
        if (foundName) {
          name = foundName;
        } else if (s.studentEmail && s.studentEmail.includes("@")) {
          const emailUser = s.studentEmail.split("@")[0];
          if (emailUser.toLowerCase() !== rollNo.toLowerCase()) {
            name = emailUser.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          } else {
            name = `Student ${rollNo}`;
          }
        } else {
          name = `Student ${rollNo}`;
        }
      }

      s.studentRollNo = rollNo;
      s.studentName = name;
    });

    // Calculate Analytics Metrics
    const totalAttempted = submissions.length;
    const passMarks = (exam.totalMarks || 20) * ((exam.passPercentage || 40) / 100);
    const passedCount = submissions.filter(s => (s.score || 0) >= passMarks || s.status === 'Pass' || s.isPassed).length;
    const failedCount = totalAttempted - passedCount;
    const passPercentage = totalAttempted > 0 ? Number(((passedCount / totalAttempted) * 100).toFixed(1)) : 0;

    const scores = submissions.map(s => Number(s.score || 0));
    const avgScore = totalAttempted > 0 ? Number((scores.reduce((a, b) => a + b, 0) / totalAttempted).toFixed(1)) : 0;
    const highestScore = totalAttempted > 0 ? Math.max(...scores) : 0;
    const lowestScore = totalAttempted > 0 ? Math.min(...scores) : 0;
    const violationCount = submissions.filter(s => (s.violationsCount || s.violations || 0) > 0).length;

    const orgDetails = await fetchOrgDetailsFromDb(orgId);

    res.status(200).json({
      success: true,
      report: {
        org: orgDetails,
        exam: {
          ...exam,
          questionsCount: questions.length
        },
        questions,
        submissions,
        analytics: {
          totalAttempted,
          passedCount,
          failedCount,
          passPercentage,
          averageScore: avgScore,
          highestScore,
          lowestScore,
          violationCount,
          passMarks
        }
      }
    });
  } catch (error) {
    console.error("Error generating exam submissions report:", error);
    res.status(500).json({ success: false, message: "Error generating exam report" });
  }
};

