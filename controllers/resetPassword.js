import User from "../models/User.js";
import bcrypt from "bcrypt";

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }
  const encrypt_password =  await bcrypt.hash(newPassword, 10);
  user.password = encrypt_password; // Hash it if using bcrypt
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;

 await user.save();

  res.json({ message: "Password updated successfully" });
};