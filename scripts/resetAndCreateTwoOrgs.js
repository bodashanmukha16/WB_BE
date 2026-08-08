import mongoose from "mongoose";
import dotenv from "dotenv";
import { getTenantContext } from "../utils/tenantConnectionManager.js";

dotenv.config();

const resetAndSeedTwoOrgs = async () => {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected successfully to MongoDB.");

    const baseConn = mongoose.connection;

    // 1. Drop existing unused databases to clean up MongoDB
    const databasesToDrop = ["wb_org_kluniv", "wb_org_vnrvjiet", "DB1"];
    for (const dbName of databasesToDrop) {
      try {
        console.log(`🗑️ Cleaning database: [${dbName}]`);
        const dbToDrop = baseConn.useDb(dbName, { useCache: true });
        await dbToDrop.dropDatabase();
        console.log(`  ✅ Dropped database: [${dbName}]`);
      } catch (err) {
        console.warn(`  ⚠️ Warning dropping ${dbName}:`, err.message);
      }
    }

    // 2. Define exactly two college organizations and two students per org
    const targetOrgs = [
      {
        orgId: "jntuk",
        name: "JNTUK College of Engineering",
        code: "KH",
        dbName: "wb_org_jntuk",
        students: [
          {
            username: "19KH1A0512",
            password: "123", // Plain text password
            email: "19KH1A0512@jntuk.edu.in",
            fullname: "Boda Subramani",
            branch: "CSE",
            orgId: "jntuk",
            organization: "JNTUK College of Engineering"
          },
          {
            username: "19KH1A0412",
            password: "123", // Plain text password
            email: "19KH1A0412@jntuk.edu.in",
            fullname: "ECE Student",
            branch: "ECE",
            orgId: "jntuk",
            organization: "JNTUK College of Engineering"
          }
        ]
      },
      {
        orgId: "aits",
        name: "Annamacharya Institute of Tech & Sciences",
        code: "A9",
        dbName: "wb_org_aits",
        students: [
          {
            username: "23A91A0401",
            password: "Student@123", // Plain text password
            email: "23A91A0401@aits.ac.in",
            fullname: "Kumar (AITS)",
            branch: "ECE",
            orgId: "aits",
            organization: "AITS Rajampet"
          },
          {
            username: "23A91A0501",
            password: "Student@123", // Plain text password
            email: "23A91A0501@aits.ac.in",
            fullname: "Priya (AITS)",
            branch: "CSE",
            orgId: "aits",
            organization: "AITS Rajampet"
          }
        ]
      }
    ];

    // 3. Reset and create isolated databases for the two target orgs
    for (const org of targetOrgs) {
      console.log(`\n==================================================`);
      console.log(`🏛️ Initializing College Organization Database: [${org.name}]`);
      console.log(`📦 Database Name: [${org.dbName}] (Code: ${org.code})`);

      const tenantContext = getTenantContext(org.orgId);
      const { User, CourseEnrollment } = tenantContext.models;

      // Drop existing collections in target DB for clean slate reset
      try {
        await User.collection.drop();
      } catch (e) {}
      try {
        await CourseEnrollment.collection.drop();
      } catch (e) {}

      // Create exactly 2 students for this org
      for (const student of org.students) {
        await User.create({
          ...student,
          role: "student"
        });
        console.log(`  👤 Created Student Account: Roll No: [${student.username}] | Pass: "${student.password}" | Org: [${org.orgId}]`);

        // Create initial course enrollment for each student
        await CourseEnrollment.create({
          userId: student.username,
          studentEmail: student.email,
          studentName: student.fullname,
          courseId: "web-dev-bootcamp",
          courseTitle: "Full-Stack Web Development Bootcamp",
          enrolledAt: new Date(),
          status: "Enrolled",
          completedTopics: [],
          progressPercentage: 0,
          lastAccessedAt: new Date()
        });
        console.log(`    📚 Created initial Course Enrollment for: [${student.username}]`);
      }
    }

    console.log(`\n==================================================`);
    console.log(`🎉 Reset Complete! Created exactly 2 Organization Databases with 2 Students each.`);
    console.log(`==================================================\n`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Reset error:", error.message);
    process.exit(1);
  }
};

resetAndSeedTwoOrgs();
