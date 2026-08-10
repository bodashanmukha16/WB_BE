import express from "express";
import { getOrgExams, getExamById, submitExam, getExamHistory } from "../controllers/examController.js";

const router = express.Router();

router.get("/", getOrgExams);
router.get("/:id", getExamById);
router.post("/:id/submit", submitExam);
router.get("/history/:userId", getExamHistory);

export default router;
