import mongoose from "mongoose";
import dotenv from "dotenv";
import { getTenantContext } from "../utils/tenantConnectionManager.js";

dotenv.config();

const collegeOrgs = [
  {
    orgId: "jntuk",
    name: "JNTUK College of Engineering",
    dbName: "wb_org_jntuk",
    sampleStudent: {
      username: "23A91A0501",
      password: "Student@123", // Plain text password as requested
      email: "student@jntuk.edu.in",
      fullname: "Shanmukha (JNTUK)",
      branch: "CSE",
      orgId: "jntuk",
      organization: "JNTUK College of Engineering"
    }
  },
  {
    orgId: "aits",
    name: "Annamacharya Institute of Tech & Sciences",
    dbName: "wb_org_aits",
    sampleStudent: {
      username: "23A91A0401",
      password: "Student@123", // Plain text password as requested
      email: "student@aits.ac.in",
      fullname: "Kumar (AITS)",
      branch: "ECE",
      orgId: "aits",
      organization: "AITS Rajampet"
    }
  },
  {
    orgId: "kluniv",
    name: "K L Deemed to be University",
    dbName: "wb_org_kluniv",
    sampleStudent: {
      username: "23A91A1201",
      password: "Student@123", // Plain text password as requested
      email: "student@kluniversity.in",
      fullname: "Ananya (KLU)",
      branch: "AI & DS",
      orgId: "kluniv",
      organization: "K L University"
    }
  },
  {
    orgId: "vnrvjiet",
    name: "VNR Vignana Jyothi Inst of Tech",
    dbName: "wb_org_vnrvjiet",
    sampleStudent: {
      username: "23A91A0502",
      password: "Student@123", // Plain text password as requested
      email: "student@vnrvjiet.in",
      fullname: "Rajesh (VNRVJIET)",
      branch: "IT",
      orgId: "vnrvjiet",
      organization: "VNRVJIET Hyderabad"
    }
  }
];

const initAllCollegeDatabases = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in .env");
    }

    console.log("Connecting to MongoDB Atlas Base Server...");
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected successfully.");

    for (const org of collegeOrgs) {
      console.log(`\n--------------------------------------------------`);
      console.log(`🏛️ Initializing database for: [${org.name}]`);
      console.log(`📦 Database Name: [${org.dbName}]`);

      const tenantContext = getTenantContext(org.orgId);
      const { User, CourseEnrollment } = tenantContext.models;

      // Sync Indexes
      await User.syncIndexes();
      await CourseEnrollment.syncIndexes();

      // Upsert sample roll number user with plain text password
      await User.findOneAndUpdate(
        { username: org.sampleStudent.username },
        { ...org.sampleStudent, role: "student" },
        { upsert: true, new: true }
      );
      console.log(`  ✅ Student roll number configured with plain text password: [${org.sampleStudent.username}]`);

      // Ensure sample enrollment exists
      const enrollmentCount = await CourseEnrollment.countDocuments();
      if (enrollmentCount === 0) {
        await CourseEnrollment.create({
          userId: org.sampleStudent.username,
          studentEmail: org.sampleStudent.email,
          studentName: org.sampleStudent.fullname,
          courseId: "web-dev-bootcamp",
          courseTitle: "Full-Stack Web Development Bootcamp",
          enrolledAt: new Date(),
          status: "Enrolled",
          completedTopics: [],
          progressPercentage: 0,
          lastAccessedAt: new Date()
        });
        console.log(`  ✅ Sample course enrollment created for: [${org.sampleStudent.username}]`);
      }
    }

    console.log(`\n==================================================`);
    console.log(`🎉 Plain text password roll number databases updated successfully!`);
    console.log(`==================================================\n`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing roll number databases:", error.message);
    process.exit(1);
  }
};

initAllCollegeDatabases();
