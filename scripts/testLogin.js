import mongoose from "mongoose";
import dotenv from "dotenv";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";

dotenv.config();

const testLoginSimulations = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected.");

    const testCases = [
      { username: "19KH1A0512", password: "123", expectedOrg: "jntuk" },
      { username: "19KH1A0412", password: "123", expectedOrg: "jntuk" },
      { username: "23A91A0401", password: "Student@123", expectedOrg: "aits" },
      { username: "23A91A0501", password: "Student@123", expectedOrg: "aits" }
    ];

    for (const tc of testCases) {
      const cleanUsername = tc.username.trim();
      const cleanPassword = tc.password.trim();

      // Resolve organization ID from .env COLLEGE_CODES
      const targetOrgId = resolveOrgFromRollNumber(cleanUsername);

      if (targetOrgId !== tc.expectedOrg) {
        console.error(`❌ MAPPING ERROR: Expected ${tc.expectedOrg} for ${cleanUsername}, but got ${targetOrgId}`);
        continue;
      }

      const tenantCtx = getTenantContext(targetOrgId);
      const userModel = tenantCtx.models.User;

      const user = await userModel.findOne({
        username: { $regex: new RegExp(`^${cleanUsername}$`, "i") }
      });

      if (!user) {
        console.error(`❌ TEST FAILED: User not found for username "${cleanUsername}" in DB [wb_org_${targetOrgId}]`);
        continue;
      }

      const isMatch = cleanPassword === (user.password || "").trim();
      if (!isMatch) {
        console.error(`❌ TEST FAILED: Password mismatch for username "${cleanUsername}".`);
        continue;
      }

      console.log(`✅ AUTH TEST PASSED: Roll No "${cleanUsername}" -> Dynamically resolved via .env to Org DB: [wb_org_${targetOrgId}]`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Test error:", error.message);
    process.exit(1);
  }
};

testLoginSimulations();
