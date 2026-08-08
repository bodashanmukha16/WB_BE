import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";

dotenv.config();

const syncAllUsers = async () => {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected.");

    const baseConn = mongoose.connection;

    // Student roll number accounts to configure
    const allUsersToSync = [
      {
        username: "19KH1A0512",
        email: "19KH1A0512@jntuk.edu.in",
        password: "123", // Plain text password
        fullname: "Subramani Boda",
        branch: "CSE",
        orgId: "jntuk",
        organization: "JNTUK College of Engineering"
      },
      {
        username: "19KH1A0412",
        email: "19KH1A0412@jntuk.edu.in",
        password: "123", // Plain text password
        fullname: "ECE Student",
        branch: "ECE",
        orgId: "jntuk",
        organization: "JNTUK College of Engineering"
      },
      {
        username: "23A91A0401",
        email: "23A91A0401@aits.ac.in",
        password: "Student@123",
        fullname: "Kumar (AITS)",
        branch: "ECE",
        orgId: "aits",
        organization: "AITS Rajampet"
      },
      {
        username: "23KL1A1201",
        email: "23KL1A1201@kluniversity.in",
        password: "Student@123",
        fullname: "Ananya (KLU)",
        branch: "AI & DS",
        orgId: "kluniv",
        organization: "K L University"
      },
      {
        username: "23VN1A0502",
        email: "23VN1A0502@vnrvjiet.in",
        password: "Student@123",
        fullname: "Rajesh (VNRVJIET)",
        branch: "IT",
        orgId: "vnrvjiet",
        organization: "VNRVJIET Hyderabad"
      },
      {
        username: "testuser",
        email: "testuser@workbench.edu",
        password: "123",
        fullname: "Test Student",
        branch: "CSE",
        orgId: "jntuk",
        organization: "JNTUK College of Engineering"
      }
    ];

    const dbList = ["DB1", "wb_org_jntuk", "wb_org_aits", "wb_org_kluniv", "wb_org_vnrvjiet"];

    for (const dbName of dbList) {
      console.log(`\n==================================================`);
      console.log(`Syncing plain text password users in database: [${dbName}]`);
      const targetConn = baseConn.useDb(dbName, { useCache: true });
      const targetCol = targetConn.collection("stu_database");

      for (const u of allUsersToSync) {
        await targetCol.updateOne(
          { username: { $regex: new RegExp(`^${u.username}$`, "i") } },
          {
            $set: {
              username: u.username,
              password: u.password,
              email: u.email,
              fullname: u.fullname,
              branch: u.branch,
              orgId: u.orgId,
              organization: u.organization,
              role: "student"
            }
          },
          { upsert: true }
        );
        console.log(`  ✅ Configured student roll number: [${u.username}] in DB [${dbName}] (Password: "${u.password}")`);
      }
    }

    console.log(`\n==================================================`);
    console.log(`🎉 Roll Number College Code Mappings Synced Successfully!`);
    console.log(`==================================================\n`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Sync error:", error.message);
    process.exit(1);
  }
};

syncAllUsers();
