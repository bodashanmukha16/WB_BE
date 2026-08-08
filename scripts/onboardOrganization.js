import readline from "readline";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getTenantContext } from "../utils/tenantConnectionManager.js";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const onboardOrganization = async () => {
  try {
    console.log(`\n=================================================================`);
    console.log(`🏛️  WORKBENCH ENTERPRISE - AUTOMATED ORGANIZATION ONBOARDING TOOL`);
    console.log(`=================================================================\n`);

    const orgName = (await askQuestion("1. Enter Organization Full Name (e.g., K L University): ")).trim();
    if (!orgName) throw new Error("Organization Name is required.");

    const rawOrgId = (await askQuestion("2. Enter Organization ID (e.g., kluniv): ")).trim().toLowerCase();
    if (!rawOrgId) throw new Error("Organization ID is required.");
    const orgId = rawOrgId.replace(/[^a-z0-9]/g, "");

    const code = (await askQuestion("3. Enter 2-Letter Roll Number College Code (e.g., KL): ")).trim().toUpperCase();
    if (!code) throw new Error("College Code is required.");

    const logo = (await askQuestion("4. Enter Organization Logo Image URL (press Enter for default): ")).trim() ||
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80";

    console.log(`\n--- STUDENT ACCOUNTS FOR [${orgName}] ---`);
    const student1Roll = (await askQuestion("Student 1 Roll Number (e.g., 23KL1A1201): ")).trim().toUpperCase() || `23${code}1A0501`;
    const student1Pass = (await askQuestion(`Student 1 Plain Text Password (default: Student@123): `)).trim() || "Student@123";
    const student1Name = (await askQuestion(`Student 1 Full Name (default: Student One): `)).trim() || "Student One";

    const student2Roll = (await askQuestion("Student 2 Roll Number (e.g., 23KL1A0502): ")).trim().toUpperCase() || `23${code}1A0502`;
    const student2Pass = (await askQuestion(`Student 2 Plain Text Password (default: Student@123): `)).trim() || "Student@123";
    const student2Name = (await askQuestion(`Student 2 Full Name (default: Student Two): `)).trim() || "Student Two";

    rl.close();

    const dbName = `wb_org_${orgId}`;
    console.log(`\n-----------------------------------------------------------------`);
    console.log(`🚀 Provisioning MongoDB Database: [${dbName}] for [${orgName}]...`);

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI is missing in process.env");

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB Atlas.");

    // Connect to target tenant DB
    const tenantCtx = getTenantContext(orgId);
    const { User, CourseEnrollment } = tenantCtx.models;

    // Create Student Accounts
    const studentsToCreate = [
      {
        username: student1Roll,
        password: student1Pass,
        email: `${student1Roll}@${orgId}.edu.in`,
        fullname: student1Name,
        branch: "CSE",
        orgId,
        organization: orgName,
        role: "student"
      },
      {
        username: student2Roll,
        password: student2Pass,
        email: `${student2Roll}@${orgId}.edu.in`,
        fullname: student2Name,
        branch: "ECE",
        orgId,
        organization: orgName,
        role: "student"
      }
    ];

    for (const s of studentsToCreate) {
      await User.findOneAndUpdate(
        { username: s.username },
        s,
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`  👤 Student Database Record Provisioned: [${s.username}] (Pass: "${s.password}")`);

      // Seed default course enrollment
      await CourseEnrollment.findOneAndUpdate(
        { userId: s.username, courseId: "web-dev-bootcamp" },
        {
          userId: s.username,
          studentEmail: s.email,
          studentName: s.fullname,
          courseId: "web-dev-bootcamp",
          courseTitle: "Full-Stack Web Development Bootcamp",
          enrolledAt: new Date(),
          status: "Enrolled",
          completedTopics: [],
          progressPercentage: 0,
          lastAccessedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`    📚 Course Database Record Provisioned: [web-dev-bootcamp] for [${s.username}]`);
    }

    // UPDATE ENVIRONMENT FILES (BE/.env and FE/FE_WB/.env)
    console.log(`\n-----------------------------------------------------------------`);
    console.log(`📝 Synchronizing Environment Files (BE/.env & FE/.env)...`);

    // 1. BE/.env
    const beEnvPath = path.resolve(process.cwd(), ".env");
    updateEnvFile(beEnvPath, code, orgId, orgName, logo, false);

    // 2. FE/.env
    const feEnvPath = path.resolve(process.cwd(), "../FE/FE_WB/.env");
    if (fs.existsSync(feEnvPath)) {
      updateEnvFile(feEnvPath, code, orgId, orgName, logo, true);
    }

    console.log(`\n=================================================================`);
    console.log(`🎉 ORGANIZATION [${orgName}] ONBOARDED SUCCESSFULLY!`);
    console.log(`📦 DB Name: [${dbName}] | Code: [${code}]`);
    console.log(`🔑 Test Logins:`);
    console.log(`   - Roll No: ${student1Roll} | Pass: ${student1Pass}`);
    console.log(`   - Roll No: ${student2Roll} | Pass: ${student2Pass}`);
    console.log(`=================================================================\n`);

    process.exit(0);

  } catch (error) {
    console.error("\n❌ Onboarding Error:", error.message);
    rl.close();
    process.exit(1);
  }
};

const updateEnvFile = (filePath, code, orgId, orgName, logo, isVite = false) => {
  try {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, "utf-8");

    const codeKey = isVite ? "VITE_COLLEGE_CODES" : "COLLEGE_CODES";
    const detailsKey = isVite ? "VITE_ORG_DETAILS" : "ORG_DETAILS";

    // Read existing codes map
    let existingCodesMap = {};
    const codeMatch = content.match(new RegExp(`${codeKey}=(.*)`));
    if (codeMatch && codeMatch[1]) {
      try { existingCodesMap = JSON.parse(codeMatch[1].trim()); } catch (e) {}
    }
    existingCodesMap[code] = orgId;

    // Read existing details map
    let existingDetailsMap = {};
    const detailsMatch = content.match(new RegExp(`${detailsKey}=(.*)`));
    if (detailsMatch && detailsMatch[1]) {
      try { existingDetailsMap = JSON.parse(detailsMatch[1].trim()); } catch (e) {}
    }
    existingDetailsMap[orgId] = {
      name: orgName,
      code: code,
      logo: logo
    };

    // Replace or append
    const newCodeLine = `${codeKey}=${JSON.stringify(existingCodesMap)}`;
    const newDetailsLine = `${detailsKey}=${JSON.stringify(existingDetailsMap)}`;

    if (content.includes(codeKey)) {
      content = content.replace(new RegExp(`${codeKey}=.*`), newCodeLine);
    } else {
      content += `\n${newCodeLine}`;
    }

    if (content.includes(detailsKey)) {
      content = content.replace(new RegExp(`${detailsKey}=.*`), newDetailsLine);
    } else {
      content += `\n${newDetailsLine}`;
    }

    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  ✅ Updated ${path.basename(filePath)} with [${code} -> ${orgId}]`);
  } catch (err) {
    console.warn(`  ⚠️ Could not update ${filePath}:`, err.message);
  }
};

onboardOrganization();
