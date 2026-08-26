import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  codeSnippet: { type: String, default: "" },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true },
  explanation: { type: String, default: "" },
  marks: { type: Number, default: 2 }
});

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  code: { type: String, required: true },
  department: { type: String, default: "cse", lowercase: true, trim: true },
  departments: [{ type: String, lowercase: true, trim: true }],
  year: { type: Number, default: 3 },
  orgId: { type: String, required: true }, // e.g. svck, aits
  category: { type: String, default: "Mid-Term Examination" }, // Mid-Term, Lab Practical, Mock Gate, Coding Test
  durationMinutes: { type: Number, default: 30 },
  totalMarks: { type: Number, default: 20 },
  passPercentage: { type: Number, default: 40 },
  status: { type: String, default: "active" }, // active, upcoming, completed
  instructions: [{ type: String }],
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now }
});

const Exam = mongoose.model("Exam", examSchema);
export default Exam;
