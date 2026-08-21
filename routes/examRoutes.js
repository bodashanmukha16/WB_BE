import express from "express";
import { getOrgExams, getExamById, submitExam, getExamHistory, getSystemIp, verifyExamIp } from "../controllers/examController.js";

const router = express.Router();

router.get("/my-ip", getSystemIp);
router.get("/", getOrgExams);
router.get("/:id", getExamById);
router.post("/:id/verify-ip", verifyExamIp);
router.post("/:id/submit", submitExam);
router.get("/history/:userId", getExamHistory);

export default router;
