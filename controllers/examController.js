/**
 * Examination Controller for Organization-Specific Secure Exams
 * All data stored under the SAME Organization Database ('wb_org_[orgId]'):
 * 1) Questions Collection: 'exam_questions'
 * 2) Results Collections by Branch: 'cse_exam_results', 'ece_exam_results', 'eee_exam_results', 'mech_exam_results', 'civil_exam_results'
 */

import mongoose from "mongoose";
import resolveStudentBranch from "../utils/branchResolver.js";

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
    console.log(yearQuery);
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

    res.status(200).json({
      success: true,
      orgId: tenantId,
      count: exams.length,
      exams
    });
  } catch (error) {
    console.error("Error fetching org exams:", error);
    res.status(500).json({ success: false, message: "Server error fetching exams" });
  }
};

export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
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

    res.status(200).json({
      success: true,
      exam: examObj
    });
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

    const submissionPayload = {
      examId: mongoIdStr,
      examTitle: examDoc.title,
      userId: userId || "guest_user",
      studentEmail: studentEmail || "student@workbench.edu",
      studentName: studentName || "Student",
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
    const { getBranchResultsModel } = req.tenantModels || {};

    const resolvedBranch = resolveStudentBranch(branch || userId);
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

    res.status(200).json({
      success: true,
      count: submissions.length,
      submissions
    });
  } catch (error) {
    console.error("Error fetching exam history:", error);
    res.status(500).json({ success: false, message: "Server error fetching exam history" });
  }
};
