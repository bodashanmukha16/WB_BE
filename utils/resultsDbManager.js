import mongoose from "mongoose";
import resolveStudentBranch from "./branchResolver.js";

let resultsDbConn = null;
const branchModelsMap = {};

const examSubmissionSchema = new mongoose.Schema({
  examId: { type: String, required: true },
  examTitle: { type: String, required: true },
  userId: { type: String, required: true },
  studentEmail: { type: String, required: true },
  studentName: { type: String, default: "Student" },
  branch: { type: String, required: true }, // e.g. cse, ece, eee, mech, civil
  orgId: { type: String, required: true },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  grade: { type: String, required: true },
  passed: { type: Boolean, required: true },
  violationsCount: { type: Number, default: 0 },
  timeSpentSeconds: { type: Number, default: 0 },
  answers: { type: Map, of: Number },
  submittedAt: { type: Date, default: Date.now }
});

/**
 * Connection to dedicated Results Database ('wb_results_db')
 */
export const getResultsDbConnection = () => {
  const baseConn = mongoose.connection;
  if (!baseConn || baseConn.readyState !== 1) {
    console.warn("Base Mongoose connection not ready yet for Results DB");
    return null;
  }

  if (!resultsDbConn) {
    resultsDbConn = baseConn.useDb("wb_results_db", { useCache: true });
    console.log("📊 Connected to Dedicated Separate Results Database: [wb_results_db]");
  }

  return resultsDbConn;
};

/**
 * Dynamic Branch Collection Model Resolver:
 * Creates/retrieves a Mongoose model specifically bound to collection: '[branch]_exam_results'
 * e.g. 'cse_exam_results', 'ece_exam_results', 'eee_exam_results', 'mech_exam_results', 'civil_exam_results'
 */
export const getBranchResultsModel = (rawBranch = "cse") => {
  const cleanBranch = resolveStudentBranch(rawBranch);
  const collectionName = `${cleanBranch.toLowerCase()}_exam_results`;

  if (branchModelsMap[collectionName]) {
    return branchModelsMap[collectionName];
  }

  const db = getResultsDbConnection();
  if (!db) {
    return mongoose.models[collectionName] || mongoose.model(collectionName, examSubmissionSchema, collectionName);
  }

  const model = db.model(collectionName, examSubmissionSchema, collectionName);
  branchModelsMap[collectionName] = model;
  console.log(`📁 Bound Branch Results Model to Collection: [${collectionName}] in DB [wb_results_db]`);
  return model;
};

/**
 * Save exam result into student's branch-specific collection in Dedicated Results Database
 */
export const saveBranchExamSubmission = async (rawBranch, payload) => {
  try {
    const cleanBranch = resolveStudentBranch(rawBranch || payload.branch || payload.userId);
    const BranchModel = getBranchResultsModel(cleanBranch);

    const submissionDoc = new BranchModel({
      ...payload,
      branch: cleanBranch
    });

    const savedDoc = await submissionDoc.save();
    console.log(`✅ Saved Exam Result for Student [${payload.userId}] into Branch Collection [${cleanBranch}_exam_results] in [wb_results_db]`);
    return savedDoc;
  } catch (error) {
    console.error("Error saving branch exam submission:", error);
    throw error;
  }
};

/**
 * Fetch exam submission history for a student from their branch-specific collection (or across branch collections)
 */
export const getStudentBranchExamHistory = async (userId, rawBranch = "") => {
  try {
    const cleanBranch = resolveStudentBranch(rawBranch || userId);
    const BranchModel = getBranchResultsModel(cleanBranch);

    let submissions = await BranchModel.find({ userId }).sort({ submittedAt: -1 });

    // Fallback: If not found in primary branch collection, search across all known branch collections
    if (!submissions || submissions.length === 0) {
      const knownBranches = ["cse", "ece", "eee", "mech", "civil", "it", "aiml"];
      for (const b of knownBranches) {
        if (b !== cleanBranch) {
          const M = getBranchResultsModel(b);
          const found = await M.find({ userId }).sort({ submittedAt: -1 });
          if (found && found.length > 0) {
            submissions = found;
            break;
          }
        }
      }
    }

    return submissions;
  } catch (error) {
    console.error("Error fetching branch exam history:", error);
    return [];
  }
};
