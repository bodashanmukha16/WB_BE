import dotenv from "dotenv";
import connectDB from "../../config/db.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";
import User from "../../models/User.js";

dotenv.config();

const orgs = [
  {
    orgId: "svck",
    code: "SVCK",
    studentsByYear: {
      1: [
        { username: "23SVCK0511", fullname: "Divya Teja", email: "divya.yr1@svck.edu.in", branch: "CSE", year: 1, semester: 1, section: "A" },
        { username: "23SVCK0512", fullname: "Eshwar Varma", email: "eshwar.yr1@svck.edu.in", branch: "CSE", year: 1, semester: 1, section: "A" }
      ],
      2: [
        { username: "23SVCK0521", fullname: "Farhan Ahmed", email: "farhan.yr2@svck.edu.in", branch: "CSE", year: 2, semester: 1, section: "A" },
        { username: "23SVCK0522", fullname: "Gautam Reddy", email: "gautam.yr2@svck.edu.in", branch: "CSE", year: 2, semester: 1, section: "A" }
      ],
      3: [
        { username: "23SVCK0531", fullname: "Harini Priya", email: "harini.yr3@svck.edu.in", branch: "CSE", year: 3, semester: 1, section: "A" },
        { username: "23SVCK0532", fullname: "Indrajit Roy", email: "indrajit.yr3@svck.edu.in", branch: "CSE", year: 3, semester: 1, section: "A" }
      ],
      4: [
        { username: "23SVCK0541", fullname: "Jaya Lakshmi", email: "jaya.yr4@svck.edu.in", branch: "CSE", year: 4, semester: 1, section: "A" },
        { username: "23SVCK0542", fullname: "Karthik Varma", email: "karthik.yr4@svck.edu.in", branch: "CSE", year: 4, semester: 1, section: "A" }
      ]
    }
  },
  {
    orgId: "aits",
    code: "AITS",
    studentsByYear: {
      1: [
        { username: "23AITS0511", fullname: "Lokesh Naidu", email: "lokesh.yr1@aits.edu.in", branch: "CSE", year: 1, semester: 1, section: "A" },
        { username: "23AITS0512", fullname: "Manasa Devi", email: "manasa.yr1@aits.edu.in", branch: "CSE", year: 1, semester: 1, section: "A" }
      ],
      2: [
        { username: "23AITS0521", fullname: "Nikhil Kumar", email: "nikhil.yr2@aits.edu.in", branch: "CSE", year: 2, semester: 1, section: "A" },
        { username: "23AITS0522", fullname: "Ojaswini Rao", email: "ojaswini.yr2@aits.edu.in", branch: "CSE", year: 2, semester: 1, section: "A" }
      ],
      3: [
        { username: "23AITS0531", fullname: "Pavan Kalyan", email: "pavan.yr3@aits.edu.in", branch: "CSE", year: 3, semester: 1, section: "A" },
        { username: "23AITS0532", fullname: "Qadir Pasha", email: "qadir.yr3@aits.edu.in", branch: "CSE", year: 3, semester: 1, section: "A" }
      ],
      4: [
        { username: "23AITS0541", fullname: "Rahul Verma", email: "rahul.yr4@aits.edu.in", branch: "CSE", year: 4, semester: 1, section: "A" },
        { username: "23AITS0542", fullname: "Sai Pallavi", email: "sai.yr4@aits.edu.in", branch: "CSE", year: 4, semester: 1, section: "A" }
      ]
    }
  },
  {
    orgId: "jntuk",
    code: "JNTUK",
    studentsByYear: {
      1: [
        { username: "23031A0511", fullname: "Aarav Sharma", email: "aarav.yr1@jntuk.edu.in", branch: "CSE", year: 1, semester: 1, section: "A" },
        { username: "23031A0512", fullname: "Bhavya Sri", email: "bhavya.yr1@jntuk.edu.in", branch: "CSE", year: 1, semester: 1, section: "A" }
      ],
      2: [
        { username: "23031A0521", fullname: "Chaitanya Kumar", email: "chaitanya.yr2@jntuk.edu.in", branch: "CSE", year: 2, semester: 1, section: "A" },
        { username: "23031A0522", fullname: "Deepa Lakshmi", email: "deepa.yr2@jntuk.edu.in", branch: "CSE", year: 2, semester: 1, section: "A" }
      ],
      3: [
        { username: "23031A0531", fullname: "Ganesh Naidu", email: "ganesh.yr3@jntuk.edu.in", branch: "CSE", year: 3, semester: 1, section: "A" },
        { username: "23031A0532", fullname: "Hemalatha", email: "hema.yr3@jntuk.edu.in", branch: "CSE", year: 3, semester: 1, section: "A" }
      ],
      4: [
        { username: "23031A0541", fullname: "Ishaan Varma", email: "ishaan.yr4@jntuk.edu.in", branch: "CSE", year: 4, semester: 1, section: "A" },
        { username: "23031A0542", fullname: "Jagadeesh", email: "jagadeesh.yr4@jntuk.edu.in", branch: "CSE", year: 4, semester: 1, section: "A" }
      ]
    }
  }
];

const resetAndSeedExact2StudentsPerYear = async () => {
  try {
    await connectDB();
    console.log("🧹 Resetting Student Databases (Deleting all old student records)...");

    // Clear global User collection
    await User.deleteMany({ role: "student" });

    for (const org of orgs) {
      const tenantCtx = getTenantContext(org.orgId);
      const TenantUser = tenantCtx.models.User;

      // 1. Delete all old student data in physical tenant database wb_org_[orgId].stu_database
      await TenantUser.deleteMany({ role: "student" });
      console.log(`  └─ 🗑️ Cleared all old student records in physical DB [wb_org_${org.orgId}.stu_database]`);

      // 2. Insert exactly 2 students per year (Years 1, 2, 3, 4)
      for (const yr of [1, 2, 3, 4]) {
        const studentPair = org.studentsByYear[yr];
        for (const s of studentPair) {
          const doc = {
            ...s,
            password: "Student@123",
            role: "student",
            orgId: org.orgId
          };

          await TenantUser.create(doc);
          await User.create(doc);
          console.log(`     └─ 🎓 Created Student: ${s.fullname} [Roll: ${s.username}] -> Year ${s.year}, Sem ${s.semester}, Sec ${s.section}`);
        }
      }
    }

    console.log("\n🎉 Exactly 2 Students per Year (Years 1-4) successfully created in SVCK, AITS, and JNTUK databases!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting and seeding student databases:", error);
    process.exit(1);
  }
};

resetAndSeedExact2StudentsPerYear();
