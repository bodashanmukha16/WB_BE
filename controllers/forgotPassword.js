import crypto from "crypto";
import User from "../models/User.js";
import nodemailer from "nodemailer";

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  // email  Template here
  const emailTemplate = (resetLink, username) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Password Reset</title>
</head>

<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

<!-- HEADER -->
<tr>
<td style="background:linear-gradient(135deg,#2563eb,#9333ea);padding:40px;text-align:center;color:white;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">WorkBench</h1>
<p style="margin-top:8px;font-size:14px;opacity:0.9;">
Empowering Your Academic Journey
</p>
</td>
</tr>

<!-- BODY -->
<tr>
<td style="padding:40px 30px;">

<h2 style="margin:0 0 15px 0;color:#111;font-size:22px;">
Reset Your Password
</h2>

<p style="color:#555;font-size:15px;line-height:1.6;">
Hello ${username || "Student"},
</p>

<p style="color:#555;font-size:15px;line-height:1.6;">
We received a request to reset your WorkBench account password.
Click the button below to set a new password.
</p>

<!-- BUTTON -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr>
<td align="center">
<a href="${resetLink}" 
style="
display:inline-block;
padding:14px 32px;
background:linear-gradient(135deg,#2563eb,#9333ea);
color:white;
text-decoration:none;
font-weight:bold;
border-radius:50px;
font-size:15px;
box-shadow:0 8px 20px rgba(37,99,235,0.3);
">
Reset Password
</a>
</td>
</tr>
</table>

<p style="color:#777;font-size:14px;line-height:1.6;">
This link will expire in <strong>15 minutes</strong>.
If you didn’t request this, please ignore this email.
</p>

<p style="color:#999;font-size:13px;margin-top:30px;">
If the button doesn’t work, copy and paste this link into your browser:
<br/>
<span style="color:#2563eb;">${resetLink}</span>
</p>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="background:#f9fafc;padding:25px;text-align:center;font-size:12px;color:#888;">
© ${new Date().getFullYear()} WorkBench. All rights reserved.<br/>
Designed for Students. Built for Success.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Generate token
  const resetToken = crypto.randomBytes(32).toString("hex");

  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins
  await user.save();

  const resetLink = `https://wb-be-q2u6.onrender.com/reset-password/${resetToken}`;

  // Send email
 const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: user.email,
    subject: "Password Reset Request",
    html:emailTemplate(resetLink, user.fullname)
  });

  res.json({ message: "Reset link sent to email" });
};