import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
import User from "../models/User.js";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";
import { resolveStudentBranch } from "../utils/branchResolver.js";

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username (roll number) and password are required"
    });
  }

  try {
    const cleanUsername = username.toString().trim();
    const cleanPassword = password.toString().trim();

    // Resolve college organization ID from roll number code strictly from .env (e.g. 23A91A0401 -> A9 -> aits)
    const targetOrgId = resolveOrgFromRollNumber(cleanUsername);
    const tenantCtx = getTenantContext(targetOrgId);
    const TargetUserModel = tenantCtx.models.User;

    const caseInsensitiveQuery = {
      $or: [
        { username: { $regex: new RegExp(`^${cleanUsername}$`, "i") } },
        { email: { $regex: new RegExp(`^${cleanUsername}$`, "i") } }
      ]
    };

    // 1. Search in target college organization database (wb_org_<targetOrgId>)
    let user = await TargetUserModel.findOne(caseInsensitiveQuery);

    // 2. Search in base DB1 database
    if (!user) {
      user = await User.findOne(caseInsensitiveQuery);
    }

    // 3. Universal fallback search across all college organization databases
    if (!user) {
      const orgList = ["jntuk", "aits"];
      for (const orgId of orgList) {
        const ctx = getTenantContext(orgId);
        user = await ctx.models.User.findOne(caseInsensitiveQuery);
        if (user) break;
      }
    }

    if (!user) {
      console.log(`❌ User not found for roll number: "${cleanUsername}"`);
      return res.status(400).json({
        message: `User not found for roll number: ${cleanUsername}`
      });
    }

    // Verify plain text password (with whitespace trimming & legacy bcrypt fallback)
    const dbPassword = (user.password || "").toString().trim();
    let isMatch = cleanPassword === dbPassword;

    if (!isMatch && dbPassword.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(cleanPassword, dbPassword);
    }

    if (!isMatch) {
      console.log(`❌ Password mismatch for roll number: "${cleanUsername}". Entered: "${cleanPassword}", Stored: "${dbPassword}"`);
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // Determine final orgId: Target Org ID derived from roll number code in .env takes highest priority!
    const finalOrgId = targetOrgId || user.orgId || "jntuk";
    const organization = user.organization || (
      finalOrgId === "aits" ? "AITS Rajampet" : "JNTUK College of Engineering"
    );

    const token = generateToken({
      ...user.toObject(),
      orgId: finalOrgId,
      organization
    });

    console.log(`✅ Login successful! Student: "${user.username}" -> College DB: [wb_org_${finalOrgId}]`);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || "student",
        name: user.fullname || user.username,
        branch: user.branch || user.department || resolveStudentBranch(user.username || user.email),
        year: user.year !== undefined ? user.year : (user.academicYear || 2),
        semester: user.semester || 1,
        section: user.section || "A",
        orgId: finalOrgId,
        organization
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Server error during authentication"
    });
  }
};
