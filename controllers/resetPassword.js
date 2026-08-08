import User from "../models/User.js";

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const TargetUserModel = req.tenantModels?.User || User;

  let user = await TargetUserModel.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) {
    user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });
  }

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  // Store password as plain text as requested
  user.password = newPassword;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;

  await user.save();

  res.json({ message: "Password updated successfully" });
};