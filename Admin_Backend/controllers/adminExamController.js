import getTenantContext from "../../utils/tenantConnectionManager.js";

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

    const questions = await ExamQuestion.find({ examId: id });

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

    const deleted = await Exam.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    await ExamQuestion.deleteMany({ examId: id });

    res.status(200).json({
      success: true,
      message: "Examination and associated questions deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting exam:", error);
    res.status(500).json({ success: false, message: "Error deleting examination" });
  }
};
