import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const inspectAllUsers = async () => {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected.");

    const dbNames = ["DB1", "wb_org_jntuk", "wb_org_aits", "wb_org_kluniv", "wb_org_vnrvjiet"];

    for (const dbName of dbNames) {
      console.log(`\n==================================================`);
      console.log(`🔍 Inspecting Database: [${dbName}]`);
      const conn = mongoose.connection.useDb(dbName, { useCache: true });

      // Check collections
      const collections = await conn.db.listCollections().toArray();
      console.log(`  Collections in ${dbName}:`, collections.map(c => c.name));

      for (const col of collections) {
        if (col.name.includes("user") || col.name.includes("stu")) {
          const docs = await conn.db.collection(col.name).find().toArray();
          console.log(`  📄 Collection [${col.name}] (${docs.length} documents):`);
          docs.forEach(d => {
            console.log(`    - ID: ${d._id} | username: "${d.username}" | email: "${d.email}" | pass: "${d.password}" | orgId: "${d.orgId}"`);
          });
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Diagnostic error:", error.message);
    process.exit(1);
  }
};

inspectAllUsers();
