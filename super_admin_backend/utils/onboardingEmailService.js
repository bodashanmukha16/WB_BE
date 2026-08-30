import nodemailer from "nodemailer";

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

export const generateOnboardingEmailHTML = ({
  recipientRole,
  recipientName,
  name,
  orgId,
  code,
  dbName,
  validUntil,
  planType,
  superadminEmail,
  orgAdminEmail,
  logoUrl
}) => {
  const isSuperAdmin = recipientRole === "SUPERADMIN";
  const formattedDate = new Date(validUntil).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Institution Onboarding Welcome - WorkBench Enterprise</title>
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
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Outer Background Container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 10px;">
    <tr>
      <td align="center">

        <!-- Main Email Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="650" class="inner-container" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; width: 650px;">
          
          <!-- Top Vibrant Banner Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 50%, #0284c7 100%); padding: 45px 35px; text-align: center; color: #ffffff;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <!-- Status Badge -->
                    <span style="background: rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 18px; border-radius: 50px; display: inline-block; margin-bottom: 16px; border: 1px solid rgba(255, 255, 255, 0.4);">
                      ${isSuperAdmin ? '⚡ SUPERADMIN AUDIT CONFIRMATION' : '🎉 INSTITUTION PROVISIONED & READY'}
                    </span>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 900; line-height: 1.2; letter-spacing: -0.5px; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      ${name}
                    </h1>
                    <p style="margin: 10px 0 0 0; font-size: 15px; font-weight: 600; opacity: 0.95; color: #e0f2fe;">
                      Multi-Tenant Enterprise Environment Live & Ready
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 40px 35px; background-color: #ffffff;">
              
              <!-- Greeting Section -->
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
                Hello ${recipientName},
              </h2>

              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.7; color: #475569;">
                ${isSuperAdmin
                  ? `Institution <strong>${name}</strong> has been onboarded into the WorkBench Enterprise Platform. An isolated tenant database <strong style="color: #0284c7;">[${dbName}]</strong> was automatically generated with inner schemas, security rules, and initial seed accounts.`
                  : `We are thrilled to welcome <strong>${name}</strong> to the WorkBench Enterprise Platform! Your dedicated institution tenant environment is live and fully provisioned with high-security examination proctoring, student management, and real-time academic analytics.`
                }
              </p>

              <!-- Bright Specifications Grid Header -->
              <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #059669; margin-bottom: 12px;">
                🏛️ Institution & Tenant Database Parameters
              </div>

              <!-- Key Specs Table Grid -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 10px 15px;">
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Institution Name:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #0f172a;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Organization ID (Key):</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; font-family: monospace; color: #0284c7;">${orgId}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">2-Letter College Code:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; font-family: monospace; color: #4338ca;">${code}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Tenant Database Name:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; font-family: monospace; color: #059669;">${dbName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">Subscription License:</td>
                  <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #7c3aed;">${planType} License</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #64748b;">Valid Until:</td>
                  <td align="right" style="padding: 10px 12px; font-size: 14px; font-weight: 800; color: #10b981;">${formattedDate}</td>
                </tr>
              </table>

              <!-- Credentials Card Box (Bright Emerald theme) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ecfdf5; border-radius: 18px; border: 1px solid #a7f3d0; padding: 22px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #047857; margin-bottom: 14px;">
                      🔑 Default Provisioned Credentials & Email Mapping
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #047857; font-weight: 600;">OrgAdmin Contact Email:</td>
                        <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 800; font-family: monospace; color: #065f46;">${orgAdminEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #047857; font-weight: 600;">SuperAdmin Audit Email:</td>
                        <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 800; font-family: monospace; color: #065f46;">${superadminEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #047857; font-weight: 600;">Default Staff Admin ID:</td>
                        <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 800; font-family: monospace; color: #4338ca;">STAFF_${code}_01</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #047857; font-weight: 600;">Default Staff Password:</td>
                        <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 800; font-family: monospace; color: #b91c1c;">Staff@123</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #047857; font-weight: 600;">Default Student Pattern:</td>
                        <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 800; font-family: monospace; color: #0284c7;">23${code}1A0501 / Student@123</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Large Primary Bright CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0 10px 0;">
                <tr>
                  <td align="center">
                    <a href="http://localhost:5174" class="cta-btn" style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; text-decoration: none; padding: 16px 38px; border-radius: 14px; font-weight: 900; font-size: 15px; letter-spacing: 0.5px; display: inline-block; box-shadow: 0 12px 25px -5px rgba(5, 150, 105, 0.4);">
                      LAUNCH INSTITUTION PORTAL NOW &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f8fafc; padding: 28px 35px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
              <p style="margin: 0; font-weight: 800; color: #334155; font-size: 13px;">WorkBench Enterprise Platform Control Center</p>
              <p style="margin: 4px 0 0 0;">Automated System Provisioning &bull; Multi-Tenant Database Manager</p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">SuperAdmin: ${superadminEmail} &bull; OrgAdmin: ${orgAdminEmail}</p>
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

export const sendOnboardingWelcomeEmails = async ({
  name,
  orgId,
  code,
  dbName,
  validUntil,
  planType,
  superadminEmail,
  orgAdminEmail,
  logoUrl
}) => {
  const transporter = createEmailTransporter();
  const fromAddress = process.env.EMAIL ? `"WorkBench Control Center" <${process.env.EMAIL}>` : '"WorkBench Control Center" <no-reply@workbench.edu>';

  const superAdminHTML = generateOnboardingEmailHTML({
    recipientRole: "SUPERADMIN",
    recipientName: "SuperAdmin Control Center",
    name,
    orgId,
    code,
    dbName,
    validUntil,
    planType,
    superadminEmail,
    orgAdminEmail,
    logoUrl
  });

  const orgAdminHTML = generateOnboardingEmailHTML({
    recipientRole: "ORGADMIN",
    recipientName: `${name} Administrator`,
    name,
    orgId,
    code,
    dbName,
    validUntil,
    planType,
    superadminEmail,
    orgAdminEmail,
    logoUrl
  });

  const emailPromises = [];

  // 1. Send Welcome Email to SuperAdmin Email
  if (superadminEmail && superadminEmail.includes("@")) {
    emailPromises.push(
      transporter.sendMail({
        from: fromAddress,
        to: superadminEmail,
        subject: `[WorkBench SuperAdmin] Institution Onboarded: ${name} (${code})`,
        html: superAdminHTML
      }).then(() => {
        console.log(`✅ Welcome & Audit Email sent to SuperAdmin [${superadminEmail}] for Org [${name}]`);
      }).catch((err) => {
        console.error(`⚠️ Failed sending email to SuperAdmin [${superadminEmail}]:`, err.message);
      })
    );
  }

  // 2. Send Welcome Email to OrgAdmin Email
  if (orgAdminEmail && orgAdminEmail.includes("@")) {
    emailPromises.push(
      transporter.sendMail({
        from: fromAddress,
        to: orgAdminEmail,
        subject: `[Welcome to WorkBench] Institution Provisioning Confirmed - ${name}`,
        html: orgAdminHTML
      }).then(() => {
        console.log(`✅ Welcome Email sent to OrgAdmin [${orgAdminEmail}] for Org [${name}]`);
      }).catch((err) => {
        console.error(`⚠️ Failed sending email to OrgAdmin [${orgAdminEmail}]:`, err.message);
      })
    );
  }

  await Promise.allSettled(emailPromises);
};
