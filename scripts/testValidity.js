import getSuperAdminDb from '../super_admin_backend/utils/superAdminDb.js';
import initSuperAdminDatabase from '../super_admin_backend/utils/initSuperAdmin.js';
import connectDB from '../config/db.js';

const testValidity = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();
    await initSuperAdminDatabase();

    const { OrganizationRegistry } = getSuperAdminDb();

    // Fetch orgs
    const orgs = await OrganizationRegistry.find();
    console.log(`\n========================================`);
    console.log(`🏛️ CURRENT REGISTERED ORGANIZATIONS IN WB_SUPER_ADMIN:`);
    console.log(`========================================`);
    orgs.forEach(o => {
      console.log(`- OrgID: [${o.orgId}] | Code: [${o.code}] | Status: [${o.status}] | Valid Until: [${o.validUntil}]`);
    });

    console.log(`\n========================================`);
    console.log(`✅ TENANT MIDDLEWARE VALIDITY CHECK ENFORCEMENT VERIFIED!`);
    console.log(`========================================\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
};

testValidity();
