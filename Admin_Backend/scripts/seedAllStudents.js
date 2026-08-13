import dotenv from "dotenv";
import connectDB from "../../config/db.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";
import User from "../../models/User.js";

dotenv.config();

const orgs = ["jntuk", "svck", "aits"];
const branches = ["CSE", "ECE", "EEE", "MECH", "CIVIL"];
const years = [1, 2, 3, 4];
const sections = ["A", "B"];

const seedStudentsForOrg = async (orgId) => {
  const tenantCtx = getTenantContext(orgId);
  const TenantUser = tenantCtx.models.User;

  const sampleNames = [
    "Aarav Sharma", "Bhavya Sri", "Chaitanya Kumar", "Divya Teja", "Eshwar Varma",
    "Farhan Ahmed", "Gautam Reddy", "Harini Priya", "Indrajit Roy", "Jaya Lakshmi",
    "Karthik Varma", "Lokesh Naidu", "Manasa Devi", "Nikhil Kumar", "Ojaswini Rao",
    "Pavan Kalyan", "Qadir Pasha", "Rahul Verma", "Sai Pallavi", "Tarun Tej"
  ];

  let count = 0;
  for (const branch of branches) {
    for (const yr of years) {
      for (const sec of sections) {
        count++;
        const rollNumber = `23${orgId.toUpperCase()}${branch}${yr}0${sec}${count < 10 ? '0' + count : count}`;
        const name = sampleNames[(count - 1) % sampleNames.length];
        const email = `std.${rollNumber.toLowerCase()}@${orgId}.edu.in`;

        const existing = await TenantUser.findOne({ username: rollNumber });
        if (!existing) {
          await TenantUser.create({
            username: rollNumber,
            fullname: `${name} (${branch}-${yr}Yr)`,
            email,
            password: "Student@123",
            branch,
            year: yr,
            semester: 1,
            section: sec,
            role: "student",
            orgId
          });

          // Also sync to global User model for authentication compatibility
          await User.updateOne(
            { username: rollNumber },
            {
              username: rollNumber,
              fullname: `${name} (${branch}-${yr}Yr)`,
              email,
              password: "Student@123",
              branch,
              year: yr,
              semester: 1,
              section: sec,
              role: "student",
              orgId
            },
            { upsert: true }
          );
        }
      }
    }
  }

  console.log(`✅ Seeded student database for Org [${orgId}] -> Database [wb_org_${orgId}.stu_database]`);
};

const runFullStudentSeeding = async () => {
  try {
    await connectDB();
    console.log("🚀 Seeding Complete Student Records for JNTUK, SVCK, and AITS across all Branches & Years...");

    for (const orgId of orgs) {
      await seedStudentsForOrg(orgId);
    }

    console.log("🎉 Student Database Seeding Complete for All Organizations!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding student databases:", error);
    process.exit(1);
  }
};

runFullStudentSeeding();
