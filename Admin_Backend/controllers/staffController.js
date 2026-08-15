import StaffUser from "../models/StaffUser.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import getTenantContext from "../../utils/tenantConnectionManager.js";

// Helper to resolve orgId from email or staffId string
const resolveOrgFromEmailOrId = (identifier = "") => {
  const str = identifier.toLowerCase().trim();
  if (str.includes("@svck.edu.in") || str.includes("svck")) return "svck";
  if (str.includes("@aits.edu.in") || str.includes("aits")) return "aits";
  if (str.includes("@jntuk.edu.in") || str.includes("jntuk")) return "jntuk";
  return "svck";
};

// Helper to resolve physical tenant StaffUser model for current organization
const getTenantStaffModel = (req, targetOrgId = null) => {
  const orgId = targetOrgId || req.headers["x-tenant-id"] || req.tenantId || "svck";
  return getTenantContext(orgId).models.StaffUser;
};

// Staff Login for Admin, Principal, HOD, and Lecturers (Queries physical org DB wb_org_[orgId].staff_database)
export const staffLogin = async (req, res) => {
  try {
    const { emailOrStaffId, password } = req.body;

    if (!emailOrStaffId || !password) {
      return res.status(400).json({ success: false, message: "Email/Staff ID and password are required" });
    }

    const searchStr = emailOrStaffId.trim();

    // Priority 1: Check if email/ID string contains explicit org key (e.g. svck, aits)
    let domainOrgId = null;
    const lowerSearch = searchStr.toLowerCase();
    if (lowerSearch.includes("svck")) domainOrgId = "svck";
    else if (lowerSearch.includes("aits")) domainOrgId = "aits";
    else if (lowerSearch.includes("jntuk")) domainOrgId = "jntuk";

    // Priority 2: Use domainOrgId if found, otherwise header, otherwise default "svck"
    let detectedOrgId = domainOrgId || req.headers["x-tenant-id"] || "svck";
    if (detectedOrgId === "undefined" || detectedOrgId === "null") detectedOrgId = "svck";

    const TenantStaff = getTenantStaffModel(req, detectedOrgId);

    // 1. Check physical tenant database collection wb_org_[detectedOrgId].staff_database
    let staff = await TenantStaff.findOne({
      $or: [
        { email: searchStr.toLowerCase() },
        { staffId: searchStr.toUpperCase() },
        { email: searchStr }
      ]
    });

    // 2. If not found in target DB, search across ALL known tenant DBs (svck, aits, jntuk)
    if (!staff) {
      const allOrgs = ["svck", "aits", "jntuk"];
      for (const org of allOrgs) {
        if (org === detectedOrgId) continue;
        try {
          const AltTenantStaff = getTenantStaffModel(req, org);
          const altStaff = await AltTenantStaff.findOne({
            $or: [
              { email: searchStr.toLowerCase() },
              { staffId: searchStr.toUpperCase() },
              { email: searchStr }
            ]
          });
          if (altStaff) {
            staff = altStaff;
            detectedOrgId = org;
            break;
          }
        } catch (e) {
          // ignore error for single org search attempt
        }
      }
    }

    // 3. Fallback to global StaffUser model if not found in any tenant DB
    if (!staff) {
      staff = await StaffUser.findOne({
        $or: [
          { email: searchStr.toLowerCase() },
          { staffId: searchStr.toUpperCase() },
          { email: searchStr }
        ]
      });
    }

    if (!staff) {
      return res.status(404).json({ success: false, message: `Staff account not found in Org DB [wb_org_${detectedOrgId}]` });
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

    const finalOrgId = (staff.orgId || detectedOrgId || "svck").toLowerCase().trim();

    const token = jwt.sign(
      {
        id: staff._id,
        staffId: staff.staffId,
        role: staff.role,
        department: staff.department,
        orgId: finalOrgId
      },
      process.env.JWT_SECRET || "antigravity_secret_key",
      { expiresIn: "7d" }
    );

    const staffObj = staff.toObject();
    delete staffObj.password;
    staffObj.orgId = finalOrgId;

    res.status(200).json({
      success: true,
      message: `Welcome, ${staff.fullname} (${staff.role.toUpperCase()}) to Org DB [wb_org_${finalOrgId}]`,
      token,
      staff: staffObj
    });
  } catch (error) {
    console.error("Error in staff login:", error);
    res.status(500).json({ success: false, message: "Server error during staff login" });
  }
};

// Fetch All Staff Members from physical Org DB (e.g. wb_org_svck.staff_database for SVCK)
export const getAllStaff = async (req, res) => {
  try {
    const { department, role } = req.query;
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();

    const TenantStaff = getTenantStaffModel(req, orgId);
    const filter = {};

    if (department && department !== "all") {
      filter.department = department.toLowerCase();
    }

    if (role && role !== "all") {
      filter.role = role.toLowerCase();
    }

    // Fetch staff physically stored inside tenant collection `wb_org_[orgId].staff_database`
    let staffList = await TenantStaff.find(filter).select("-password").sort({ fullname: 1 });

    // Fallback to global model filter if physical tenant collection is being initialized
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

// Create Staff Member inside physical Org DB (wb_org_[orgId].staff_database)
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

    // Save physically in tenant org DB `wb_org_[orgId].staff_database`
    const newTenantStaff = new TenantStaff(newStaffData);
    await newTenantStaff.save();

    // Also sync in global StaffUser for login lookup
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
