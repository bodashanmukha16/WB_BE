import { findUserByResetToken } from "./TokenValidator.js";

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters long." });
    }

    // Search for user across global DB and all tenant databases
    const match = await findUserByResetToken(token);

    if (!match || !match.user) {
      return res.status(400).json({ message: "Invalid or expired password reset token." });
    }

    const user = match.user;

    // Update password & clear reset token fields
    user.password = newPassword.trim();
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    console.log(`✅ Password successfully reset for User "${user.username}" in tenant database!`);

    return res.json({
      success: true,
      message: "Password updated successfully. You can now sign in with your new password."
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: error.message || "Failed to reset password." });
  }
};