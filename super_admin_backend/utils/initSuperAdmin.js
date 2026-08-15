import bcrypt from 'bcrypt';
import getSuperAdminDb from './superAdminDb.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

export const initSuperAdminDatabase = async () => {
  try {
    const { SuperAdmin, OrganizationRegistry } = getSuperAdminDb();

    // 1. Seed Default Super Admin Account if none exists
    const existingAdmin = await SuperAdmin.findOne({
      $or: [{ username: 'superadmin' }, { email: 'superadmin@workbench.com' }]
    });

    if (!existingAdmin) {
      const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(defaultPassword, salt);

      await SuperAdmin.create({
        username: 'superadmin',
        email: process.env.SUPERADMIN_EMAIL || 'superadmin@workbench.com',
        password: passwordHash,
        fullname: 'System Super Administrator',
        role: 'superadmin'
      });
      console.log('✅ Default Super Admin Account Seeded (user: superadmin, pass: SuperAdmin@123)');
    }

    // 2. Sync Existing Organizations from process.env (COLLEGE_CODES & ORG_DETAILS)
    let envCodes = {};
    let envDetails = {};
    try {
      if (process.env.COLLEGE_CODES) envCodes = JSON.parse(process.env.COLLEGE_CODES);
      if (process.env.ORG_DETAILS) envDetails = JSON.parse(process.env.ORG_DETAILS);
    } catch (e) {
      console.warn('⚠️ Could not parse env college codes/details:', e.message);
    }

    // Default orgs fallback if env missing
    if (Object.keys(envDetails).length === 0) {
      envDetails = {
        aits: { name: 'AITS Rajampet', code: 'AITS', logo: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80' },
        svck: { name: 'SV College of Engineering', code: 'KH', logo: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80' }
      };
    }

    for (const [orgId, details] of Object.entries(envDetails)) {
      const cleanOrgId = orgId.toLowerCase().trim();
      const existingOrg = await OrganizationRegistry.findOne({ orgId: cleanOrgId });

      if (!existingOrg) {
        await OrganizationRegistry.create({
          orgId: cleanOrgId,
          name: details.name || cleanOrgId.toUpperCase(),
          code: details.code || 'CODE',
          logo: details.logo || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80',
          dbName: `wb_org_${cleanOrgId}`,
          status: 'active',
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year default
        });
        console.log(`🏛️ Synced Organization Registry for: [${cleanOrgId}] -> DB [wb_org_${cleanOrgId}]`);
      }
    }
  } catch (error) {
    console.error('❌ Super Admin DB Init Failed:', error.message);
  }
};

export default initSuperAdminDatabase;
