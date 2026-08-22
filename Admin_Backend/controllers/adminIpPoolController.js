import getSuperAdminDb from "../../super_admin_backend/utils/superAdminDb.js";
import { getCandidateIps } from "../../utils/ipUtils.js";

/**
 * 1. Fetch College Organization IP Pool & Lockdown Status
 */
export const getCollegeIpPool = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || req.query.orgId || "svck";
    const cleanOrgId = tenantId.toString().toLowerCase().trim();

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
      return res.status(404).json({ success: false, message: `Organization '${tenantId}' not found in registry.` });
    }

    const candidateIps = getCandidateIps(req);

    res.status(200).json({
      success: true,
      orgId: org.orgId,
      orgName: org.name,
      orgCode: org.code,
      isIpRestrictionEnabled: org.isIpRestrictionEnabled !== false,
      allowedIpPool: org.allowedIpPool || [],
      currentSystemIp: candidateIps[0] || '127.0.0.1',
      candidateIps
    });
  } catch (error) {
    console.error("getCollegeIpPool error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Add New IPv4 Address to College Organization IP Pool
 */
export const addCollegeIpPoolEntry = async (req, res) => {
  try {
    const { ip, label } = req.body;
    if (!ip) {
      return res.status(400).json({ success: false, message: 'IPv4 address or CIDR entry is required.' });
    }

    const tenantId = req.tenantId || req.headers["x-tenant-id"] || req.body.orgId || "svck";
    const cleanOrgId = tenantId.toString().toLowerCase().trim();

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
      return res.status(404).json({ success: false, message: `Organization '${tenantId}' not found.` });
    }

    const cleanIp = ip.trim();
    const currentPool = org.allowedIpPool || [];
    const exists = currentPool.some(item => item.ip === cleanIp);

    if (!exists) {
      const newPool = [
        ...currentPool,
        { ip: cleanIp, label: label || 'College Lab Computer', addedAt: new Date() }
      ];
      await OrganizationRegistry.updateOne(
        { _id: org._id },
        { $set: { allowedIpPool: newPool, updatedAt: new Date() } }
      );
      org.allowedIpPool = newPool;
    }

    console.log(`\n➕ COLLEGE ADMIN MONGODB UPDATE: Whitelisted IP '${cleanIp}' saved for Org '${org.orgId.toUpperCase()}'.`);

    res.status(200).json({
      success: true,
      message: `IP '${cleanIp}' whitelisted successfully for ${org.name}.`,
      allowedIpPool: org.allowedIpPool || []
    });
  } catch (error) {
    console.error("addCollegeIpPoolEntry error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Delete IPv4 Address Entry from College Organization IP Pool
 */
export const removeCollegeIpPoolEntry = async (req, res) => {
  try {
    const { ipId } = req.params;
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || req.query.orgId || "svck";
    const cleanOrgId = tenantId.toString().toLowerCase().trim();

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
      return res.status(404).json({ success: false, message: `Organization '${tenantId}' not found.` });
    }

    const updatedPool = (org.allowedIpPool || []).filter(
      item => item._id?.toString() !== ipId && item.ip !== ipId
    );

    await OrganizationRegistry.updateOne(
      { _id: org._id },
      { $set: { allowedIpPool: updatedPool, updatedAt: new Date() } }
    );

    console.log(`\n🗑️ COLLEGE ADMIN MONGODB UPDATE: Removed IP '${ipId}' from Org '${org.orgId.toUpperCase()}'.`);

    res.status(200).json({
      success: true,
      message: `IP entry removed from whitelist.`,
      allowedIpPool: updatedPool
    });
  } catch (error) {
    console.error("removeCollegeIpPoolEntry error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Toggle College Exam IP Lockdown Enforcement (ENABLE / DISABLE)
 */
export const toggleCollegeIpRestriction = async (req, res) => {
  try {
    const { isIpRestrictionEnabled } = req.body;
    const tenantId = req.tenantId || req.headers["x-tenant-id"] || req.body.orgId || "svck";
    const cleanOrgId = tenantId.toString().toLowerCase().trim();

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
      return res.status(404).json({ success: false, message: `Organization '${tenantId}' not found.` });
    }

    const newStatus = Boolean(isIpRestrictionEnabled);
    await OrganizationRegistry.updateOne(
      { _id: org._id },
      { $set: { isIpRestrictionEnabled: newStatus, updatedAt: new Date() } }
    );

    console.log(`\n🔒 COLLEGE ADMIN MONGODB UPDATE: Lockdown set to ${newStatus ? 'ENABLED' : 'DISABLED'} for Org '${org.orgId.toUpperCase()}'.`);

    res.status(200).json({
      success: true,
      message: `IP Location Lockdown set to ${newStatus ? 'ENABLED' : 'DISABLED'} for ${org.name}.`,
      isIpRestrictionEnabled: newStatus
    });
  } catch (error) {
    console.error("toggleCollegeIpRestriction error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
