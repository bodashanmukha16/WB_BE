import getSuperAdminDb from '../utils/superAdminDb.js';
import getTenantContext from '../../utils/tenantConnectionManager.js';
import { refreshCollegeCodeMap } from '../../utils/rollNumberResolver.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

/**
 * 1. Public Organizations Endpoint (Unauthenticated) for dynamic frontend resolution
 */
export const getPublicOrganizations = async (req, res) => {
  try {
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgs = await OrganizationRegistry.find({ status: 'active' }).sort({ name: 1 });

    const collegeCodes = {};
    const organizations = {};

    for (const org of orgs) {
      if (org.code && org.orgId) {
        collegeCodes[org.code.toUpperCase()] = org.orgId.toLowerCase();
      }
      organizations[org.orgId.toLowerCase()] = {
        name: org.name,
        code: org.code.toUpperCase(),
        logo: org.logo,
        orgId: org.orgId.toLowerCase()
      };
    }

    res.status(200).json({
      success: true,
      collegeCodes,
      organizations,
      rawList: orgs.map(o => ({ orgId: o.orgId, name: o.name, code: o.code, logo: o.logo }))
    });
  } catch (error) {
    console.error('getPublicOrganizations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

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

    // 4. Refresh in-memory Organization College Code Map
    await refreshCollegeCodeMap();

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

    await refreshCollegeCodeMap();

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
 * 7. Delete Organization (Removes from registry and optionally drops tenant DB)
 */
export const deleteOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { dropDatabase = false } = req.body || {};

    const cleanOrgId = orgId.toLowerCase().trim();
    const { OrganizationRegistry } = getSuperAdminDb();
    const org = await OrganizationRegistry.findOne({ orgId: cleanOrgId });

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }

    const code = org.code;
    const dbName = org.dbName || `wb_org_${cleanOrgId}`;

    // 1. Delete from Master Organization Registry (wb_super_admin)
    await OrganizationRegistry.deleteOne({ orgId: cleanOrgId });

    // 2. Optionally drop tenant MongoDB database
    let dbDropped = false;
    if (dropDatabase) {
      try {
        const tenantConn = mongoose.connection.useDb(dbName);
        await tenantConn.dropDatabase();
        dbDropped = true;
      } catch (dbErr) {
        console.warn(`Could not drop database ${dbName}:`, dbErr.message);
      }
    }

    // 3. Refresh in-memory cache
    await refreshCollegeCodeMap();

    res.status(200).json({
      success: true,
      message: `Organization '${org.name}' (${cleanOrgId}) was permanently deleted.${dbDropped ? ' Tenant database dropped.' : ''}`,
      orgId: cleanOrgId
    });
  } catch (error) {
    console.error('deleteOrganization error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. Manage Organization Whitelisted IP Pool
 */
export const getOrgIpPool = async (req, res) => {
  try {
    const { orgId } = req.params;
    const cleanOrgId = orgId.toLowerCase().trim();
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgRegex = new RegExp(`^${cleanOrgId}$`, 'i');
    const org = await OrganizationRegistry.findOne({
      $or: [
        { orgId: orgRegex },
        { code: orgRegex },
        { dbName: `wb_org_${cleanOrgId}` },
        { dbName: cleanOrgId }
      ]
    }).lean() || await OrganizationRegistry.findOne({}).lean();

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }
    res.status(200).json({
      success: true,
      orgId: org.orgId,
      isIpRestrictionEnabled: org.isIpRestrictionEnabled !== false,
      allowedIpPool: org.allowedIpPool || []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addOrgIpPoolEntry = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { ip, label } = req.body;
    if (!ip) {
      return res.status(400).json({ success: false, message: 'IP address or CIDR entry is required.' });
    }
    const cleanOrgId = orgId.toLowerCase().trim();
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgRegex = new RegExp(`^${cleanOrgId}$`, 'i');
    let org = await OrganizationRegistry.findOne({
      $or: [
        { orgId: orgRegex },
        { code: orgRegex },
        { dbName: `wb_org_${cleanOrgId}` },
        { dbName: cleanOrgId }
      ]
    }) || await OrganizationRegistry.findOne({});

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }

    const cleanIp = ip.trim();
    const currentPool = org.allowedIpPool || [];
    const exists = currentPool.some(item => item.ip === cleanIp);

    if (!exists) {
      const newPool = [
        ...currentPool,
        { ip: cleanIp, label: label || 'College Lab System', addedAt: new Date() }
      ];
      await OrganizationRegistry.updateOne(
        { _id: org._id },
        { $set: { allowedIpPool: newPool, updatedAt: new Date() } }
      );
      org.allowedIpPool = newPool;
    }

    console.log(`\n➕ MongoDB UPDATE SUCCESS: Whitelisted IP '${cleanIp}' saved for Org '${org.orgId.toUpperCase()}'.`);
    console.log(`🗄️ Current MongoDB Allowed IP Pool:`, org.allowedIpPool.map(i => i.ip), `\n`);

    res.status(200).json({
      success: true,
      message: `IP '${cleanIp}' whitelisted for ${org.name}.`,
      allowedIpPool: org.allowedIpPool || []
    });
  } catch (error) {
    console.error("addOrgIpPoolEntry error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeOrgIpPoolEntry = async (req, res) => {
  try {
    const { orgId, ipId } = req.params;
    const cleanOrgId = orgId.toLowerCase().trim();
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgRegex = new RegExp(`^${cleanOrgId}$`, 'i');
    const org = await OrganizationRegistry.findOne({
      $or: [
        { orgId: orgRegex },
        { code: orgRegex },
        { dbName: `wb_org_${cleanOrgId}` },
        { dbName: cleanOrgId }
      ]
    }) || await OrganizationRegistry.findOne({});

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }

    const updatedPool = (org.allowedIpPool || []).filter(
      item => item._id?.toString() !== ipId && item.ip !== ipId
    );

    await OrganizationRegistry.updateOne(
      { _id: org._id },
      { $set: { allowedIpPool: updatedPool, updatedAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: `IP removed from whitelist.`,
      allowedIpPool: updatedPool
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleOrgIpRestriction = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { isIpRestrictionEnabled } = req.body;
    const cleanOrgId = orgId.toLowerCase().trim();
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgRegex = new RegExp(`^${cleanOrgId}$`, 'i');
    const org = await OrganizationRegistry.findOne({
      $or: [
        { orgId: orgRegex },
        { code: orgRegex },
        { dbName: `wb_org_${cleanOrgId}` },
        { dbName: cleanOrgId }
      ]
    }) || await OrganizationRegistry.findOne({});

    if (!org) {
      return res.status(404).json({ success: false, message: `Organization '${orgId}' not found.` });
    }

    const newStatus = Boolean(isIpRestrictionEnabled);
    await OrganizationRegistry.updateOne(
      { _id: org._id },
      { $set: { isIpRestrictionEnabled: newStatus, updatedAt: new Date() } }
    );

    console.log(`\n🔒 MongoDB UPDATE SUCCESS: Lockdown status for Org '${org.orgId.toUpperCase()}' set to ${newStatus ? 'ENABLED' : 'DISABLED'}.\n`);

    res.status(200).json({
      success: true,
      message: `IP Restriction set to ${newStatus ? 'ENABLED' : 'DISABLED'} for ${org.name}.`,
      isIpRestrictionEnabled: newStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


