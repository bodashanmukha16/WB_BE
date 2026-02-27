import crypto from "crypto";
import User from "../models/User.js";
import nodemailer from "nodemailer";

export const TokenValidator = async (req, res) => {
  const user = await User.findOne({
    resetToken: req.params.token,
    resetTokenExpiry: { $gt: Date.now() },
  });

  if (!user) return res.status(400).json({ message: "Invalid token" });

  res.json({ message: "Valid token" });
};