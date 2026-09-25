import nodemailer from "nodemailer";
import getSuperAdminDb from "../super_admin_backend/utils/superAdminDb.js";

// Create reusable SMTP transporter for email notifications
export const createEmailTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn("⚠️ SMTP Credentials not configured in .env (EMAIL & EMAIL_PASS). Welcome email attempt will proceed in log mode if SMTP unverified.");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    tls: { rejectUnauthorized: false }
  });
};

/**
 * Generate rich, modern HTML template for Student Welcome Email
 */
export const generateStudentWelcomeEmailHTML = ({
  fullname,
  rollNumber,
  email,
  password,
  branch,
  year,
  semester,
  section,
  collegeName = "SV College of Engineering",
  collegeCode = "SVCK",
  collegeLogo = "",
  portalUrl = "http://localhost:5173"
}) => {
  const logoSrc = collegeLogo || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80";

  return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${collegeName} - Student Portal Access</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .inner-container { width: 100% !important; padding: 20px 15px !important; }
      .responsive-grid { display: block !important; width: 100% !important; }
      .grid-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .mobile-center { text-align: center !important; }
      .cta-btn { width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Outer Background Container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; padding: 40px 10px;">
    <tr>
      <td align="center">

        <!-- Main Email Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="650" class="inner-container" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); border: 1px solid #334155; width: 650px;">
          
          <!-- Top Vibrant Banner Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%); padding: 42px 35px; text-align: center; color: #ffffff;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">

                    <!-- College Logo -->
                    <img src="${logoSrc}" alt="${collegeName}" width="72" height="72" style="display: block; width: 72px; height: 72px; border-radius: 20px; object-fit: cover; border: 3px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 25px rgba(0,0,0,0.3); margin-bottom: 16px;" />

                    <!-- Status Badge -->
                    <span style="background: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 18px; border-radius: 50px; display: inline-block; margin-bottom: 14px; border: 1px solid rgba(255, 255, 255, 0.35);">
                      🎓 OFFICIAL STUDENT ACCOUNT PROVISIONED
                    </span>

                    <h1 style="margin: 0; font-size: 26px; font-weight: 900; line-height: 1.2; letter-spacing: -0.5px; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                      Welcome to ${collegeName}
                    </h1>

                    <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 600; color: #e0e7ff; opacity: 0.95;">
                      WorkBench Autonomous Student Portal • Code: ${collegeCode}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 38px 35px; background-color: #ffffff;">
              
              <!-- Greeting Section -->
              <h2 style="margin: 0 0 12px 0; font-size: 21px; font-weight: 800; color: #0f172a;">
                Hello ${fullname || rollNumber}, 🎉
              </h2>

              <p style="margin: 0 0 26px 0; font-size: 15px; line-height: 1.7; color: #475569;">
                Congratulations and welcome to <strong>${collegeName}</strong>! Your official student profile has been created in the institutional ERP database. You can now access your personal academic dashboard, track daily attendance, participate in online examinations, and review performance reports.
              </p>

              <!-- Academic Profile Parameters Header -->
              <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #4f46e5; margin-bottom: 12px;">
                🏛️ Registered Student Profile
              </div>

              <!-- Student Profile Specifications Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 26px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 8px 16px;">
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Full Name:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #0f172a;">${fullname || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Student Roll No / ID:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; font-family: monospace; color: #4338ca;">${rollNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Branch / Department:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #0284c7;">${(branch || "CSE").toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Academic Year & Semester:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #7c3aed;">Year ${year || 3} (Sem ${semester || 1})</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #64748b;">Class Section:</td>
                  <td align="right" style="padding: 10px 12px; font-size: 14px; font-weight: 800; color: #059669;">Section ${section || "A"}</td>
                </tr>
              </table>

              <!-- Credentials Box (Indigo / Violet Theme) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ff; border-radius: 18px; border: 1px solid #ddd6fe; padding: 22px; margin-bottom: 28px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #5b21b6; margin-bottom: 14px;">
                      🔑 Student Portal Access Credentials
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #5b21b6; font-weight: 600;">Login Username / Roll No:</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 900; font-family: monospace; color: #4338ca;">${rollNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #5b21b6; font-weight: 600;">Registered Email:</td>
                        <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 800; font-family: monospace; color: #1e40af;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #5b21b6; font-weight: 600;">Temporary Initial Password:</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 900; font-family: monospace; color: #b91c1c; background: #fee2e2; padding: 4px 10px; border-radius: 6px; display: inline-block;">${password || "Student@123"}</td>
                      </tr>
                    </table>

                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #c4b5fd; font-size: 12px; color: #6b21a8; font-weight: 600;">
                      💡 <strong>Security Note:</strong> Please login and update your password immediately from your profile settings.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Student Portal Features Showcase -->
              <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 12px;">
                ⚡ What You Can Do On WorkBench Portal:
              </div>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #334155; font-weight: 600;">
                    📊 <strong>Live Attendance Tracker</strong> &mdash; Monitor subject-wise & monthly attendance percentages.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #334155; font-weight: 600;">
                    📝 <strong>Online Exam System</strong> &mdash; Take proctored mid/semester exams with automated scoring.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #334155; font-weight: 600;">
                    📜 <strong>Academic Master Dossier</strong> &mdash; View and download official transcript reports anytime.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #334155; font-weight: 600;">
                    🔔 <strong>Instant Announcements</strong> &mdash; Receive real-time circulars from your HOD and Principal.
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 10px 0;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" class="cta-btn" style="background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-weight: 900; font-size: 15px; letter-spacing: 0.5px; display: inline-block; box-shadow: 0 12px 25px -5px rgba(79, 70, 229, 0.4);">
                      LOGIN TO STUDENT PORTAL NOW &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f8fafc; padding: 26px 35px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
              <p style="margin: 0; font-weight: 800; color: #334155; font-size: 13px;">${collegeName} &bull; WorkBench Campus ERP</p>
              <p style="margin: 4px 0 0 0;">Automated Student Onboarding &bull; Academic Management System</p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">This is an automated operational email. If you believe you received this by mistake, please contact college administration.</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;
};

/**
 * Send Welcome Email to Newly Added Student
 */
export const sendStudentWelcomeEmail = async ({
  fullname,
  rollNumber,
  email,
  password,
  branch,
  year,
  semester,
  section,
  orgId = "jntuk"
}) => {
  if (!email || !email.includes("@")) {
    console.log(`⚠️ Cannot send welcome email: Invalid or missing email address for student [${rollNumber}]`);
    return { success: false, reason: "Missing or invalid email address" };
  }

  // 1. Fetch organization details dynamically from SuperAdmin DB if available
  let collegeName = "SV College of Engineering";
  let collegeCode = orgId ? orgId.toUpperCase() : "SVCK";
  let collegeLogo = "";

  try {
    const { OrganizationRegistry } = getSuperAdminDb();
    const cleanOrgId = (orgId || "").toLowerCase().trim();
    const orgRegex = new RegExp(`^${cleanOrgId}$`, "i");

    const masterOrg = await OrganizationRegistry.findOne({
      $or: [
        { orgId: orgRegex },
        { code: orgRegex },
        { dbName: `wb_org_${cleanOrgId}` },
        { dbName: cleanOrgId }
      ]
    }).lean();

    if (masterOrg) {
      if (masterOrg.name) collegeName = masterOrg.name;
      if (masterOrg.code) collegeCode = masterOrg.code;
      if (masterOrg.logo) collegeLogo = masterOrg.logo;
    }
  } catch (err) {
    console.log("ℹ️ SuperAdmin DB organization lookup info:", err.message);
  }

  const portalUrl = process.env.STUDENT_PORTAL_URL || process.env.FRONTEND_URL || "http://localhost:5173";

  // 2. Generate HTML email content
  const htmlContent = generateStudentWelcomeEmailHTML({
    fullname,
    rollNumber,
    email,
    password: password || "Student@123",
    branch,
    year,
    semester,
    section,
    collegeName,
    collegeCode,
    collegeLogo,
    portalUrl
  });

  // 3. Dispatch Email via Nodemailer Transporter
  try {
    const transporter = createEmailTransporter();
    const senderEmail = process.env.EMAIL || process.env.SMTP_USER || "no-reply@workbench.edu";
    const fromAddress = `"${collegeName} - Student Portal" <${senderEmail}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `🎉 Welcome to ${collegeName}! Your Student Account Credentials [${rollNumber}]`,
      html: htmlContent
    });

    console.log(`✅ Welcome email dispatched successfully to student [${email}] (Roll No: ${rollNumber}) - Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`⚠️ Failed to send welcome email to student [${email}] (${rollNumber}):`, error.message);
    return { success: false, error: error.message };
  }
};
