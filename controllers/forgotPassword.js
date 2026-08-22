import crypto from "crypto";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import getTenantContext from "../utils/tenantConnectionManager.js";
import resolveOrgFromRollNumber from "../utils/rollNumberResolver.js";
import getSuperAdminDb from "../super_admin_backend/utils/superAdminDb.js";

// Helper function to mask email for privacy in API response (e.g., s***a@svck.edu.in)
const maskEmail = (email = "") => {
  if (!email || !email.includes("@")) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name.charAt(0)}***@${domain}`;
  return `${name.charAt(0)}***${name.charAt(name.length - 1)}@${domain}`;
};

export const forgotPassword = async (req, res) => {
  try {
    // Accepts rollNumber, email, or rollNumberOrEmail
    const rawInput = req.body.rollNumber || req.body.email || req.body.rollNumberOrEmail || "";
    const cleanInput = rawInput.toString().trim();

    if (!cleanInput) {
      return res.status(400).json({ message: "Student Roll Number or Email is required." });
    }

    // 1. Dynamically resolve College Organization ID from Roll Number (e.g. '19KH1A0512' -> 'KH' -> 'svck')
    const resolvedOrgId = resolveOrgFromRollNumber(cleanInput);
    console.log(`🔍 Forgot Password Request for: "${cleanInput}" -> Resolved Org DB [wb_org_${resolvedOrgId}]`);

    // 2. Fetch tenant context model ('stu_database' inside wb_org_[orgId])
    const tenantContext = getTenantContext(resolvedOrgId);
    const TenantUserModel = tenantContext?.models?.User || User;

    const searchRegex = new RegExp(`^${cleanInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}$`, "i");

    // 3. Search for Student User by Roll Number (username) or Email
    let user = await TenantUserModel.findOne({
      $or: [{ username: searchRegex }, { email: searchRegex }]
    });

    let activeModel = TenantUserModel;

    // Fallback to global User model if not found in specific tenant DB
    if (!user) {
      user = await User.findOne({
        $or: [{ username: searchRegex }, { email: searchRegex }]
      });
      activeModel = User;
    }

    if (!user) {
      return res.status(404).json({
        message: `No registered student account found for Roll Number / Email "${cleanInput}".`
      });
    }

    if (!user.email) {
      return res.status(400).json({
        message: `No email address registered for Roll Number ${user.username || cleanInput}. Please contact College Admin.`
      });
    }

    // 4. Fetch Organization Logo & College Name from SuperAdmin OrganizationRegistry
    let orgLogo = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80";
    let orgName = user.organization || "SV College of Engineering";

    try {
      const { OrganizationRegistry } = getSuperAdminDb();
      const orgRecord = await OrganizationRegistry.findOne({
        $or: [{ orgId: resolvedOrgId.toLowerCase() }, { code: resolvedOrgId.toUpperCase() }]
      });
      if (orgRecord) {
        if (orgRecord.logo) orgLogo = orgRecord.logo;
        if (orgRecord.name) orgName = orgRecord.name;
      }
    } catch (dbErr) {
      console.log("ℹ️ SuperAdmin DB Organization query fallback:", dbErr.message);
    }

    // 5. Generate Reset Token & Expiry (15 minutes)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    user.resetToken = resetToken;
    user.resetTokenExpiry = expiry;
    await user.save();

    // Explicitly update via MongoDB $set to guarantee persistence across schemas
    await activeModel.updateOne(
      { _id: user._id },
      { $set: { resetToken: resetToken, resetTokenExpiry: expiry } }
    );

    console.log(`🔑 Reset Token saved for Roll No [${user.username}]: Token = ${resetToken.substring(0, 8)}... (Expires: ${expiry.toISOString()})`);

    // 6. Construct React Frontend Reset Password Link
    const clientOrigin = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${clientOrigin}/reset-password/${resetToken}`;

    // Email HTML Template featuring WorkBench Header + College Image Logo + Student Dossier Card
    const emailTemplate = (link, username, rollNo, collegeName, logoUrl) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Password Reset - WorkBench</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 15px 35px rgba(15,23,42,0.1);border:1px solid #e2e8f0;">
  
  <!-- BRAND HEADER WITH WORKBENCH & ORG LOGO -->
  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%);padding:35px 30px;text-align:center;color:white;position:relative;">
      
      <!-- Organization Image Logo -->
      <table align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;">
        <tr>
          <td align="center">
            <img src="${logoUrl}" alt="${collegeName}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:18px;object-fit:cover;border:3px solid #6366f1;box-shadow:0 8px 20px rgba(0,0,0,0.3);" />
          </td>
        </tr>
      </table>

      <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">
        Work<span style="color:#818cf8;">Bench</span> Campus ERP
      </h1>
      
      <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,0.15);padding:4px 14px;border-radius:50px;font-size:12px;font-weight:600;color:#e0e7ff;letter-spacing:0.03em;">
        ${collegeName}
      </div>

    </td>
  </tr>

  <!-- BODY CONTENT -->
  <tr>
    <td style="padding:40px 35px;">
      
      <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:22px;font-weight:700;">
        Password Reset Request
      </h2>
      
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Hello <strong>${username || "Student"}</strong>, we received a password reset request for your student account at <strong>${collegeName}</strong>.
      </p>

      <!-- STUDENT DOSSIER SUMMARY CARD -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:14px;padding:18px 20px;margin-bottom:28px;border:1px solid #cbd5e1;">
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:6px;">Student Roll Number</td>
                <td style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:6px;text-align:right;">Registered Email</td>
              </tr>
              <tr>
                <td style="font-size:16px;color:#0f172a;font-weight:800;font-family:monospace;">${rollNo || cleanInput}</td>
                <td style="font-size:14px;color:#2563eb;font-weight:700;text-align:right;">${maskEmail(user.email)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- RESET BUTTON -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 28px 0;">
        <tr>
          <td align="center">
            <a href="${link}" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#4f46e5 0%,#2563eb 100%);color:#ffffff;text-decoration:none;font-weight:800;border-radius:50px;font-size:15px;box-shadow:0 10px 25px rgba(79,70,229,0.35);letter-spacing:0.02em;">
              Reset My Password →
            </a>
          </td>
        </tr>
      </table>

      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 20px 0;text-align:center;">
        ⏱️ This password reset link will expire in <strong>15 minutes</strong> for security reasons.
      </p>

      <div style="border-t:1px solid #e2e8f0;padding-top:20px;margin-top:20px;">
        <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;">
          If the button doesn't work, copy and paste this link into your web browser:<br/>
          <a href="${link}" style="color:#4f46e5;word-break:break-all;font-size:12px;">${link}</a>
        </p>
      </div>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8fafc;padding:24px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      © ${new Date().getFullYear()} WorkBench Autonomous Campus ERP Platform.<br/>
      Official Security Notification for ${collegeName}.
    </td>
  </tr>

</table>

</td>
</tr>
</table>
</body>
</html>
`;

    // 7. Send email via Nodemailer
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
      from: `"${orgName} - WorkBench ERP" <${process.env.EMAIL}>`,
      to: user.email,
      subject: `[${orgName}] Password Reset Request - Roll No: ${user.username}`,
      html: emailTemplate(resetLink, user.fullname || user.username, user.username, orgName, orgLogo)
    });

    const hiddenEmail = maskEmail(user.email);
    console.log(`✅ Password Reset Email dispatched with Org Logo for Roll No [${user.username}] -> Email [${user.email}]`);

    return res.json({
      success: true,
      message: `Password reset link sent successfully to registered email ${hiddenEmail} for Roll No ${user.username}.`,
      email: hiddenEmail,
      rollNumber: user.username,
      organization: orgName,
      logo: orgLogo
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: error.message || "Failed to process password reset request." });
  }
};
