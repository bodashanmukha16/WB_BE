import connectDB from "../../config/db.js";
import StaffUser from "../models/StaffUser.js";

const verifyAndFixStaffOrgIds = async () => {
  try {
    await connectDB();
    console.log("🔍 Verifying Staff Accounts in Database...");

    const allStaff = await StaffUser.find({});
    for (const st of allStaff) {
      let resolvedOrgId = st.orgId;

      if (st.email.includes("@svck.edu.in") || st.staffId.startsWith("SVCK")) {
        resolvedOrgId = "svck";
      } else if (st.email.includes("@aits.edu.in") || st.staffId.startsWith("AITS")) {
        resolvedOrgId = "aits";
      } else if (st.email.includes("@jntuk.edu.in") || st.email.includes("workbench") || st.staffId.startsWith("ADM") || st.staffId.startsWith("PRN") || st.staffId.startsWith("HOD") || st.staffId.startsWith("LEC")) {
        resolvedOrgId = "jntuk";
      }

      if (st.orgId !== resolvedOrgId) {
        st.orgId = resolvedOrgId;
        await st.save();
        console.log(`  └─ 🛠️ Updated orgId for [${st.fullname}] (${st.staffId}) -> [${resolvedOrgId}]`);
      } else {
        console.log(`  └─ ✅ Verified [${st.fullname}] (${st.staffId}) -> Org: [${st.orgId}]`);
      }
    }

    console.log("🎉 Staff Accounts Organization Data Isolation Verification Complete!");
    process.exit(0);
  } catch (error) {
    console.error("Error verifying staff orgId:", error);
    process.exit(1);
  }
};

verifyAndFixStaffOrgIds();
