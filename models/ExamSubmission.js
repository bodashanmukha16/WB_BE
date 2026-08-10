import mongoose from "mongoose";

const examSubmissionSchema = new mongoose.Schema({
  examId: { type: String, required: true },
  examTitle: { type: String, required: true },
  userId: { type: String, required: true },
  studentEmail: { type: String, required: true },
  studentName: { type: String, default: "Student" },
  orgId: { type: String, required: true },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  grade: { type: String, required: true },
  passed: { type: Boolean, required: true },
  violationsCount: { type: Number, default: 0 },
  timeSpentSeconds: { type: Number, default: 0 },
  answers: { type: Map, of: Number }, // questionId -> selectedOptionIndex
  submittedAt: { type: Date, default: Date.now }
});

const ExamSubmission = mongoose.model("ExamSubmission", examSubmissionSchema);
export default ExamSubmission;
