import express from 'express'
import { login, updateProfile } from "../controllers/authController.js"
import { forgotPassword } from '../controllers/forgotPassword.js';
import { resetPassword } from "../controllers/resetPassword.js";
import { TokenValidator } from '../controllers/TokenValidator.js';
const router = express.Router();

router.post('/login', login)
router.post('/update-profile', updateProfile)
router.put('/profile', updateProfile)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/verify-reset-token/:token", TokenValidator)
export default router