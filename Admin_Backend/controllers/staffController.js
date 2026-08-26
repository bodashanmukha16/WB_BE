import StaffUser from "../models/StaffUser.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import getTenantContext from "../../utils/tenantConnectionManager.js";
import getSuperAdminDb from "../../super_admin_backend/utils/superAdminDb.js";
import { resolveOrgFromRollNumber, getCollegeCodeMap } from "../../utils/rollNumberResolver.js";

// Helper to dynamically fetch all registered and known tenant organization IDs
const getAllTenantOrgIds = async () => {
  const orgSet = new Set(["svck", "aits", "jntuk", "s"]);
  try {
    const codeMap = getCollegeCodeMap();
    Object.values(codeMap).forEach(id => {
      if (id) orgSet.add(id.toLowerCase().trim());
    });

    const { OrganizationRegistry } = getSuperAdminDb();
    const regOrgs = await OrganizationRegistry.find().select("orgId code");
    regOrgs.forEach(o => {
      if (o.orgId) orgSet.add(o.orgId.toLowerCase().trim());
      if (o.code) orgSet.add(o.code.toLowerCase().trim());
    });
  } catch (e) {
    // Fallback if super admin db is not reachable
  }
  return Array.from(orgSet);
};

// Helper to resolve physical tenant StaffUser model for current organization
const getTenantStaffModel = (req, targetOrgId = null) => {
  const orgId = targetOrgId || req.headers["x-tenant-id"] || req.tenantId || "svck";
  const cleanOrgId = orgId.toString().toLowerCase().trim();
  const codeMap = getCollegeCodeMap();
  const resolvedId = (codeMap[cleanOrgId.toUpperCase()] || cleanOrgId).toLowerCase().trim();
  return getTenantContext(resolvedId).models.StaffUser;
};

// Staff Login for Admin, Principal, HOD, and Lecturers (Queries physical org DB wb_org_[orgId].staff_database)
export const staffLogin = async (req, res) => {
  try {
    const { emailOrStaffId, password } = req.body;

    if (!emailOrStaffId || !password) {
      return res.status(400).json({ success: false, message: "Email/Staff ID and password are required" });
    }

    const searchStr = emailOrStaffId.trim();
    const lowerSearch = searchStr.toLowerCase();

    // 1. Resolve detectedOrgId dynamically using resolveOrgFromRollNumber & codeMap
    let detectedOrgId = null;
    const headerOrg = req.headers["x-tenant-id"];

    if (headerOrg && headerOrg !== "undefined" && headerOrg !== "null") {
      const codeMap = getCollegeCodeMap();
      detectedOrgId = (codeMap[headerOrg.toUpperCase()] || headerOrg).toLowerCase().trim();
    }

    if (!detectedOrgId || detectedOrgId === "svck") {
      detectedOrgId = resolveOrgFromRollNumber(searchStr);
    }

    if (!detectedOrgId) detectedOrgId = "svck";
    let cleanOrgId = detectedOrgId.toLowerCase().trim();

    // 2. Search primary target tenant database collection wb_org_[cleanOrgId].staff_database
    const TenantStaff = getTenantStaffModel(req, cleanOrgId);
    let staff = await TenantStaff.findOne({
      $or: [
        { email: lowerSearch },
        { staffId: searchStr.toUpperCase() },
        { email: searchStr }
      ]
    });

    let finalOrgId = cleanOrgId;

    // 3. If not found in primary DB, search across ALL registered tenant DBs dynamically (svck, aits, sits, jntuk, etc.)
    if (!staff) {
      const allOrgs = await getAllTenantOrgIds();
      for (const org of allOrgs) {
        if (org === cleanOrgId) continue;
        try {
          const AltTenantStaff = getTenantStaffModel(req, org);
          const altStaff = await AltTenantStaff.findOne({
            $or: [
              { email: lowerSearch },
              { staffId: searchStr.toUpperCase() },
              { email: searchStr }
            ]
          });
          if (altStaff) {
            staff = altStaff;
            finalOrgId = org;
            break;
          }
        } catch (e) {
          // Continue to next org
        }
      }
    }

    // 4. Fallback to global StaffUser model if not found in any tenant DB
    if (!staff) {
      staff = await StaffUser.findOne({
        $or: [
          { email: lowerSearch },
          { staffId: searchStr.toUpperCase() },
          { email: searchStr }
        ]
      });
    }

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: `Staff account '${searchStr}' not found in any organization database. Please verify your Staff ID.`
      });
    }

    // Password verification (bcrypt or plain-text fallback)
    let isMatch = false;
    if (staff.password.startsWith("$2b$") || staff.password.startsWith("$2a$")) {
      isMatch = await bcrypt.compare(password, staff.password);
    } else {
      isMatch = staff.password === password;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid password or credentials" });
    }

    const resolvedFinalOrgId = (staff.orgId || finalOrgId || "svck").toLowerCase().trim();

    // ENFORCE ORGANIZATION SUBSCRIPTION VALIDITY CHECK
    try {
      const { OrganizationRegistry } = getSuperAdminDb();
      const orgRecord = await OrganizationRegistry.findOne({
        $or: [
          { orgId: resolvedFinalOrgId },
          { code: resolvedFinalOrgId.toUpperCase() },
          { dbName: `wb_org_${resolvedFinalOrgId}` }
        ]
      });

      if (orgRecord) {
        const now = new Date();
        if (orgRecord.status === 'suspended') {
          console.warn(`⛔ LOGIN BLOCKED: Staff '${staff.staffId}' belongs to SUSPENDED Institution '${orgRecord.name}' [${orgRecord.orgId}].`);
          return res.status(403).json({
            success: false,
            error: "ORGANIZATION_SUSPENDED",
            message: `Institution '${orgRecord.name}' subscription is currently SUSPENDED. Access to administrative portal is blocked. Please contact Super Admin.`
          });
        }
        if (orgRecord.status === 'expired' || (orgRecord.validUntil && new Date(orgRecord.validUntil) < now)) {
          console.warn(`⛔ LOGIN BLOCKED: Staff '${staff.staffId}' belongs to EXPIRED Institution '${orgRecord.name}' [${orgRecord.orgId}].`);
          return res.status(403).json({
            success: false,
            error: "SUBSCRIPTION_EXPIRED",
            message: `Institution '${orgRecord.name}' subscription has expired. Access to administrative portal is blocked. Please contact Super Admin to renew.`
          });
        }
      }
    } catch (orgErr) {
      console.error("Error verifying org status during staff login:", orgErr.message);
    }

    const token = jwt.sign(
      {
        id: staff._id,
        staffId: staff.staffId,
        role: staff.role,
        department: staff.department,
        orgId: resolvedFinalOrgId
      },
      process.env.JWT_SECRET || "antigravity_secret_key",
      { expiresIn: "7d" }
    );

    const staffObj = staff.toObject();
    delete staffObj.password;
    staffObj.orgId = resolvedFinalOrgId;

    res.status(200).json({
      success: true,
      message: `Welcome, ${staff.fullname} (${staff.role.toUpperCase()}) to Org DB [wb_org_${resolvedFinalOrgId}]`,
      token,
      staff: staffObj
    });
  } catch (error) {
    console.error("Error in staff login:", error);
    res.status(500).json({ success: false, message: "Server error during staff login" });
  }
};

// Fetch All Staff Members from physical Org DB
export const getAllStaff = async (req, res) => {
  try {
    const { department, role } = req.query;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();

    const queryRole = (req.query.role || req.headers["x-user-role"] || req.headers["x-staff-role"] || req.userRole || req.staffUser?.role || "admin").toString().toLowerCase().trim();
    const queryDept = (department || req.headers["x-user-branch"] || req.headers["x-user-dept"] || req.headers["x-staff-dept"] || req.userDept || req.staffUser?.department || "all").toString().toLowerCase().trim();

    const TenantStaff = getTenantStaffModel(req, orgId);
    const filter = {};

    let targetDept = queryDept;
    if ((queryRole === "hod" || queryRole === "lecturer") && queryDept !== "all") {
      targetDept = queryDept;
    }

    if (targetDept && targetDept !== "all") {
      filter.$or = [
        { department: new RegExp(`^${targetDept.trim()}$`, "i") },
        { department: "all" }
      ];
    }

    if (role && role !== "all") {
      filter.role = role.toLowerCase();
    }

    let staffList = await TenantStaff.find(filter).select("-password").sort({ fullname: 1 });

    if (staffList.length === 0) {
      filter.$or = [{ orgId }, { orgId: { $exists: false } }];
      staffList = await StaffUser.find(filter).select("-password").sort({ fullname: 1 });
    }

    res.status(200).json({
      success: true,
      count: staffList.length,
      orgId,
      dbName: `wb_org_${orgId}`,
      staff: staffList
    });
  } catch (error) {
    console.error("Error fetching staff list:", error);
    res.status(500).json({ success: false, message: "Error fetching staff records" });
  }
};

// Create Staff Member inside physical Org DB
export const createStaff = async (req, res) => {
  try {
    const { staffId, fullname, email, password, role, department, assignedSubjects, phone } = req.body;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();

    const TenantStaff = getTenantStaffModel(req, orgId);

    const existing = await TenantStaff.findOne({
      $or: [{ email: email.toLowerCase() }, { staffId: staffId.toUpperCase() }]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: `Staff ID or Email already exists in Org DB [wb_org_${orgId}]` });
    }

    const hashedPassword = await bcrypt.hash(password || "College@123", 10);

    const newStaffData = {
      staffId: staffId.toUpperCase(),
      fullname,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "lecturer",
      department: department ? department.toLowerCase() : "cse",
      phone,
      assignedSubjects: assignedSubjects || [],
      orgId
    };

    const newTenantStaff = new TenantStaff(newStaffData);
    await newTenantStaff.save();

    await StaffUser.updateOne(
      { staffId: staffId.toUpperCase() },
      { $set: newStaffData },
      { upsert: true }
    );

    const savedObj = newTenantStaff.toObject();
    delete savedObj.password;

    res.status(201).json({
      success: true,
      message: `Staff account created successfully in Physical Org DB [wb_org_${orgId}]`,
      staff: savedObj
    });
  } catch (error) {
    console.error("Error creating staff:", error);
    res.status(500).json({ success: false, message: "Error creating staff account" });
  }
};

// Update Staff Member
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();
    const TenantStaff = getTenantStaffModel(req, orgId);

    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    let updatedStaff = await TenantStaff.findByIdAndUpdate(id, updateData, { new: true }).select("-password");

    if (!updatedStaff) {
      updatedStaff = await StaffUser.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
    }

    if (!updatedStaff) {
      return res.status(404).json({ success: false, message: "Staff record not found" });
    }

    res.status(200).json({ success: true, message: "Staff record updated successfully", staff: updatedStaff });
  } catch (error) {
    console.error("Error updating staff:", error);
    res.status(500).json({ success: false, message: "Error updating staff record" });
  }
};

// Delete Staff Member
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();
    const TenantStaff = getTenantStaffModel(req, orgId);

    let deleted = await TenantStaff.findByIdAndDelete(id);
    if (!deleted) {
      deleted = await StaffUser.findByIdAndDelete(id);
    }

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Staff record not found" });
    }
    res.status(200).json({ success: true, message: "Staff record deleted successfully" });
  } catch (error) {
    console.error("Error deleting staff:", error);
    res.status(500).json({ success: false, message: "Error deleting staff record" });
  }
};
