import getSuperAdminDb from '../utils/superAdminDb.js';
import getTenantContext from '../../utils/tenantConnectionManager.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

/**
 * 2. Get All Active & Registered Organizations Data + Dashboard Metrics
 */
export const getAllOrganizations = async (req, res) => {
  try {
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgs = await OrganizationRegistry.find().sort({ createdAt: -1 });

    const orgList = [];
    let grandTotalStudents = 0;
    let grandTotalStaff = 0;
    let grandTotalStorageBytes = 0;
    const now = new Date();

    for (const org of orgs) {
      const tenantCtx = getTenantContext(org.orgId);
      const { User, StaffUser } = tenantCtx.models;

      // Student and staff count
      let studentCount = 0;
      let staffCount = 0;
      try {
        if (User) studentCount = await User.countDocuments();
        if (StaffUser) staffCount = await StaffUser.countDocuments();
      } catch (e) {
        console.warn(`Could not count users for ${org.orgId}:`, e.message);
      }

      // Calculate DB stats
      let dbStats = { dataSize: 0, storageSize: 0, objects: 0, collections: 0 };
      try {
        const stats = await tenantCtx.connection.db.stats();
        dbStats = {
          dataSize: stats.dataSize || 0,
          storageSize: stats.storageSize || 0,
          objects: stats.objects || 0,
          collections: stats.collections || 0
        };
      } catch (e) {
        // Fallback stats
      }

      // Check validity status
      let effectiveStatus = org.status;
      if (org.validUntil && new Date(org.validUntil) < now && org.status === 'active') {
        effectiveStatus = 'expired';
      }

      const daysRemaining = org.validUntil
        ? Math.ceil((new Date(org.validUntil) - now) / (1000 * 60 * 60 * 24))
        : 0;

      grandTotalStudents += studentCount;
      grandTotalStaff += staffCount;
      grandTotalStorageBytes += dbStats.storageSize;

      orgList.push({
        _id: org._id,
        orgId: org.orgId,
        name: org.name,
        code: org.code,
        logo: org.logo,
        dbName: org.dbName,
        status: effectiveStatus,
        planType: org.planType,
        validFrom: org.validFrom,
        validUntil: org.validUntil,
        daysRemaining,
        studentCount,
        staffCount,
        dbStats: {
          ...dbStats,
          dataSizeMB: (dbStats.dataSize / (1024 * 1024)).toFixed(2),
          storageSizeMB: (dbStats.storageSize / (1024 * 1024)).toFixed(2)
        },
        createdAt: org.createdAt
      });
    }

    res.status(200).json({
      success: true,
      summary: {
        totalOrgs: orgList.length,
        activeOrgs: orgList.filter(o => o.status === 'active').length,
        expiredOrgs: orgList.filter(o => o.status === 'expired').length,
        suspendedOrgs: orgList.filter(o => o.status === 'suspended').length,
        grandTotalStudents,
        grandTotalStaff,
        totalStorageMB: (grandTotalStorageBytes / (1024 * 1024)).toFixed(2)
      },
      organizations: orgList
    });
  } catch (error) {
    console.error('getAllOrganizations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Detail of Org Data (Database stats, Students with Department filters, Staff list)
 */
export const getOrgDetails = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { branch, search, page = 1, limit = 50 } = req.query;

    const { OrganizationRegistry } = getSuperAdminDb();
    const org = await OrganizationRegistry.findOne({ orgId: orgId.toLowerCase().trim() });

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }

    const tenantCtx = getTenantContext(org.orgId);
    const { User, StaffUser, Subject, Exam } = tenantCtx.models;

    // Build Student Filter
    const studentQuery = {};
    if (branch && branch.toUpperCase() !== 'ALL') {
      studentQuery.branch = new RegExp(`^${branch.trim()}$`, 'i');
    }
    if (search) {
      studentQuery.$or = [
        { username: new RegExp(search, 'i') },
        { fullname: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    // Paginated Students
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const students = await User.find(studentQuery)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ username: 1 });

    const totalStudentsCount = await User.countDocuments(studentQuery);

    // Branch Breakdown
    const branchStats = await User.aggregate([
      { $group: { _id: "$branch", count: { $sum: 1 } } }
    ]);

    // Staff List
    const staffList = await StaffUser.find().select('-password').sort({ fullname: 1 });

    // College Subjects Count & Exams Count
    const subjectsCount = await Subject.countDocuments();
    const examsCount = await Exam.countDocuments();

    // DB Detailed Stats
    let dbStats = {};
    try {
      dbStats = await tenantCtx.connection.db.stats();
    } catch (e) {
      dbStats = { dataSize: 0, storageSize: 0, collections: 0, objects: 0, indexes: 0 };
    }

    // Collections List inside tenant DB
    let collections = [];
    try {
      const cols = await tenantCtx.connection.db.listCollections().toArray();
      collections = cols.map(c => c.name);
    } catch (e) {}

    res.status(200).json({
      success: true,
      organization: org,
      dbStats: {
        ...dbStats,
        dataSizeMB: (dbStats.dataSize / (1024 * 1024)).toFixed(2),
        storageSizeMB: (dbStats.storageSize / (1024 * 1024)).toFixed(2)
      },
      collections,
      students: {
        data: students,
        total: totalStudentsCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalStudentsCount / parseInt(limit))
      },
      branchStats,
      staffList,
      metrics: {
        totalSubjects: subjectsCount,
        totalExams: examsCount,
        totalStaff: staffList.length
      }
    });
  } catch (error) {
    console.error('getOrgDetails error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Onboarding New Institution (Creates DB, inner schemas, registers org, updates .env)
 */
export const onboardOrganization = async (req, res) => {
  try {
    const {
      name,
      orgId: rawOrgId,
      code: rawCode,
      logo,
      validityDays = 365,
      contactEmail,
      planType = 'Enterprise',
      seedStudents = true
    } = req.body;

    if (!name || !rawOrgId || !rawCode) {
      return res.status(400).json({
        success: false,
        message: 'Institution Full Name, Org ID, and College Code are required.'
      });
    }

    const orgId = rawOrgId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const code = rawCode.trim().toUpperCase();
    const dbName = `wb_org_${orgId}`;
    const logoUrl = logo || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80';

    const { OrganizationRegistry } = getSuperAdminDb();
    const existing = await OrganizationRegistry.findOne({
      $or: [{ orgId }, { code }]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An Organization with ID '${orgId}' or Code '${code}' already exists.`
      });
    }

    // 1. Provision MongoDB Tenant Database
    const tenantCtx = getTenantContext(orgId);
    const { User, CourseEnrollment, StaffUser, Subject, Exam } = tenantCtx.models;

    // Seed default student accounts if enabled
    if (seedStudents) {
      const student1Roll = `23${code}1A0501`;
      const student2Roll = `23${code}1A0502`;

      const initialStudents = [
        {
          username: student1Roll,
          password: 'Student@123',
          email: `${student1Roll.toLowerCase()}@${orgId}.edu.in`,
          fullname: 'Student One',
          branch: 'CSE',
          year: 3,
          semester: 1,
          section: 'A',
          orgId,
          role: 'student'
        },
        {
          username: student2Roll,
          password: 'Student@123',
          email: `${student2Roll.toLowerCase()}@${orgId}.edu.in`,
          fullname: 'Student Two',
          branch: 'ECE',
          year: 3,
          semester: 1,
          section: 'A',
          orgId,
          role: 'student'
        }
      ];

      for (const s of initialStudents) {
        await User.findOneAndUpdate({ username: s.username }, s, { upsert: true });
        await CourseEnrollment.findOneAndUpdate(
          { userId: s.username, courseId: 'web-dev-bootcamp' },
          {
            userId: s.username,
            studentEmail: s.email,
            studentName: s.fullname,
            courseId: 'web-dev-bootcamp',
            courseTitle: 'Full-Stack Web Development Bootcamp',
            enrolledAt: new Date(),
            status: 'Enrolled'
          },
          { upsert: true }
        );
      }

      // Seed Default Staff Account
      await StaffUser.findOneAndUpdate(
        { staffId: `STAFF_${code}_01` },
        {
          staffId: `STAFF_${code}_01`,
          fullname: `Dr. Head of Department (${code})`,
          email: `hod@${orgId}.edu.in`,
          password: 'Staff@123',
          role: 'admin',
          department: 'CSE',
          orgId
        },
        { upsert: true }
      );
    }

    // 2. Calculate Validity Dates
    const validFrom = new Date();
    const validUntil = new Date(Date.now() + parseInt(validityDays) * 24 * 60 * 60 * 1000);

    // 3. Register in Master Organization Database (wb_super_admin)
    const newOrg = await OrganizationRegistry.create({
      orgId,
      name,
      code,
      logo: logoUrl,
      dbName,
      status: 'active',
      validFrom,
      validUntil,
      contactEmail: contactEmail || `admin@${orgId}.edu.in`,
      planType
    });

    // 4. Update Environment Files (BE/.env and FE/FE_WB/.env)
    syncEnvFiles(code, orgId, name, logoUrl);

    res.status(201).json({
      success: true,
      message: `Organization '${name}' successfully onboarded with DB [${dbName}]!`,
      organization: newOrg
    });
  } catch (error) {
    console.error('onboardOrganization error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Update Validity & Access Control (Update expiry date, extend subscription, activate/suspend)
 */
export const updateOrgValidity = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, validUntil, extensionDays, planType } = req.body;

    const { OrganizationRegistry } = getSuperAdminDb();
    const org = await OrganizationRegistry.findOne({ orgId: orgId.toLowerCase().trim() });

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }

    if (status && ['active', 'suspended', 'expired'].includes(status)) {
      org.status = status;
    }

    if (validUntil) {
      org.validUntil = new Date(validUntil);
    } else if (extensionDays) {
      const currentExpiry = new Date(org.validUntil || Date.now());
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      org.validUntil = new Date(baseDate.getTime() + parseInt(extensionDays) * 24 * 60 * 60 * 1000);
    }

    if (planType) {
      org.planType = planType;
    }

    // Auto-update status if validity was extended beyond now
    if (org.validUntil > new Date() && org.status === 'expired') {
      org.status = 'active';
    }

    org.updatedAt = new Date();
    await org.save();

    res.status(200).json({
      success: true,
      message: `Validity & Access permissions updated for '${org.name}'.`,
      organization: org
    });
  } catch (error) {
    console.error('updateOrgValidity error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper to sync .env files
 */
const syncEnvFiles = (code, orgId, name, logo) => {
  try {
    const beEnvPath = path.resolve(process.cwd(), '.env');
    const feEnvPath = path.resolve(process.cwd(), '../FE/FE_WB/.env');

    updateSingleEnvFile(beEnvPath, code, orgId, name, logo, false);
    if (fs.existsSync(feEnvPath)) {
      updateSingleEnvFile(feEnvPath, code, orgId, name, logo, true);
    }
  } catch (err) {
    console.warn('Env sync error:', err.message);
  }
};

const updateSingleEnvFile = (filePath, code, orgId, name, logo, isVite = false) => {
  try {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');

    const codeKey = isVite ? 'VITE_COLLEGE_CODES' : 'COLLEGE_CODES';
    const detailsKey = isVite ? 'VITE_ORG_DETAILS' : 'ORG_DETAILS';

    let existingCodesMap = {};
    const codeMatch = content.match(new RegExp(`${codeKey}=(.*)`));
    if (codeMatch && codeMatch[1]) {
      try { existingCodesMap = JSON.parse(codeMatch[1].trim()); } catch (e) {}
    }
    existingCodesMap[code] = orgId;

    let existingDetailsMap = {};
    const detailsMatch = content.match(new RegExp(`${detailsKey}=(.*)`));
    if (detailsMatch && detailsMatch[1]) {
      try { existingDetailsMap = JSON.parse(detailsMatch[1].trim()); } catch (e) {}
    }
    existingDetailsMap[orgId] = { name, code, logo };

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

    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    console.warn(`Could not update ${filePath}:`, err.message);
  }
};
