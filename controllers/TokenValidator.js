import User from "../models/User.js";
import getTenantContext from "../utils/tenantConnectionManager.js";
import { getCollegeCodeMap } from "../utils/rollNumberResolver.js";

/**
 * Searches for a user by resetToken across global DB1 and all physical organization tenant databases.
 * Uses exact token matching + in-memory JS expiry check to avoid Mongoose Date vs Number comparison issues.
 */
export const findUserByResetToken = async (token) => {
  if (!token) return null;

  const now = Date.now();

  const checkUserExpiry = (user, orgName = "global") => {
    if (!user) return false;
    if (!user.resetTokenExpiry) {
      console.log(`⚠️ User "${user.username}" in [${orgName}] has resetToken but missing expiry.`);
      return false;
    }
    const expiryTime = new Date(user.resetTokenExpiry).getTime();
    if (expiryTime > now) {
      console.log(`🔑 Reset Token matched in Org DB [${orgName}] for user: "${user.username}" (Expires in ${Math.round((expiryTime - now)/1000)}s)`);
      return true;
    } else {
      console.log(`⏰ Reset Token for user "${user.username}" in [${orgName}] expired at ${new Date(expiryTime).toISOString()} (Current: ${new Date().toISOString()})`);
      return false;
    }
  };

  // 1. Try global User model (DB1)
  try {
    let user = await User.findOne({ resetToken: token });
    if (user && checkUserExpiry(user, "DB1")) {
      return { user, targetModel: User, orgId: "default" };
    }
  } catch (err) {
    console.error("Error querying global User for reset token:", err);
  }

  // 2. Iterate through all active tenant organization databases
  const codeMap = getCollegeCodeMap();
  const orgIds = Array.from(new Set([
    ...Object.values(codeMap).map(v => v.toLowerCase()),
    "svck", "aits", "jntuk", "kluniv", "vnrvjiet", "default"
  ]));

  for (const orgId of orgIds) {
    try {
      const tenantContext = getTenantContext(orgId);
      const TenantUser = tenantContext?.models?.User;
      if (TenantUser) {
        let user = await TenantUser.findOne({ resetToken: token });
        if (user && checkUserExpiry(user, `wb_org_${orgId}`)) {
          return { user, targetModel: TenantUser, orgId };
        }
      }
    } catch (e) {
      // Ignore tenant connection errors during scan
    }
  }

  return null;
};

export const TokenValidator = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({ message: "Reset token is required." });
    }

    const match = await findUserByResetToken(token);

    if (!match || !match.user) {
      console.log(`❌ Invalid or expired reset token validation attempt for token: "${token}"`);
      return res.status(400).json({ message: "Invalid or expired password reset token." });
    }

    return res.json({
      success: true,
      message: "Valid token",
      email: match.user.email,
      username: match.user.username
    });
  } catch (err) {
    console.error("TokenValidator Error:", err);
    return res.status(500).json({ message: err.message || "Failed to validate reset token." });
  }
};