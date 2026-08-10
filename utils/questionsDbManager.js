import mongoose from "mongoose";

let questionsDbConn = null;
let questionModel = null;

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  examId: { type: String, required: true },
  orgId: { type: String, required: true },
  subject: { type: String, default: "General" },
  text: { type: String, required: true },
  codeSnippet: { type: String, default: "" },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true },
  explanation: { type: String, default: "" },
  marks: { type: Number, default: 2 },
  createdAt: { type: Date, default: Date.now }
});

/**
 * Resolves connection to dedicated Questions Database ('wb_questions_db')
 */
export const getQuestionsDbConnection = () => {
  const baseConn = mongoose.connection;
  if (!baseConn || baseConn.readyState !== 1) {
    console.warn("Base Mongoose connection not ready yet for Questions DB");
    return null;
  }

  if (!questionsDbConn) {
    questionsDbConn = baseConn.useDb("wb_questions_db", { useCache: true });
    console.log("📚 Connected to Dedicated Separate Database: [wb_questions_db]");
  }

  return questionsDbConn;
};

/**
 * Returns Question Mongoose model bound to 'wb_questions_db' -> collection 'exam_questions'
 */
export const getQuestionModel = () => {
  const db = getQuestionsDbConnection();
  if (!db) {
    return mongoose.models.Question || mongoose.model("Question", questionSchema, "exam_questions");
  }

  if (!questionModel) {
    questionModel = db.model("Question", questionSchema, "exam_questions");
  }
  return questionModel;
};

/**
 * Fetch questions for specific examId from dedicated Questions Database
 */
export const getQuestionsByExamIdFromDb = async (examId) => {
  try {
    const Question = getQuestionModel();
    const questions = await Question.find({ examId }).sort({ createdAt: 1 });
    return questions;
  } catch (error) {
    console.error("Error querying dedicated Questions DB:", error);
    return [];
  }
};

/**
 * Seed/save questions into dedicated Questions Database
 */
export const saveQuestionsToDb = async (examId, orgId, subject, questions) => {
  try {
    const Question = getQuestionModel();
    for (const q of questions) {
      const qId = q.id || q.questionId || `q_${Date.now()}_${Math.random()}`;
      await Question.updateOne(
        { examId, questionId: qId },
        {
          $set: {
            questionId: qId,
            examId,
            orgId,
            subject: subject || "General",
            text: q.text,
            codeSnippet: q.codeSnippet || "",
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            explanation: q.explanation || "",
            marks: q.marks || 2
          }
        },
        { upsert: true }
      );
    }
    console.log(`✅ Saved ${questions.length} questions to Dedicated Database [wb_questions_db] for exam [${examId}]`);
  } catch (error) {
    console.error("Error saving questions to dedicated DB:", error);
  }
};
