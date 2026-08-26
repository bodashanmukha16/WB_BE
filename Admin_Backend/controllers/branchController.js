import getTenantContext from "../../utils/tenantConnectionManager.js";

const getTenantBranchModel = (req) => {
  if (req.tenantModels && req.tenantModels.Branch) {
    return req.tenantModels.Branch;
  }
  const orgId = req.headers["x-tenant-id"] || req.tenantId || "svck";
  const ctx = getTenantContext(orgId);
  return ctx.models.Branch;
};

const checkAdminOrPrincipal = (req) => {
  const queryRole = (
    req.query.role ||
    req.headers["x-user-role"] ||
    req.headers["x-staff-role"] ||
    req.userRole ||
    req.staffUser?.role ||
    "lecturer"
  ).toString().toLowerCase().trim();

  return queryRole === "admin" || queryRole === "principal" || queryRole === "superadmin";
};

// 1. Fetch All Registered College Branches
export const getBranches = async (req, res) => {
  try {
    const Branch = getTenantBranchModel(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";
    const { status } = req.query;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    let branches = await Branch.find(filter).sort({ branchCode: 1 });

    // Fallback seed if database has 0 branches
    if (!branches || branches.length === 0) {
      const defaultBranches = [
        { branchCode: "CSE", branchName: "Computer Science & Engineering", status: "active", orgId },
        { branchCode: "ECE", branchName: "Electronics & Communication Engineering", status: "active", orgId },
        { branchCode: "EEE", branchName: "Electrical & Electronics Engineering", status: "active", orgId },
        { branchCode: "MECH", branchName: "Mechanical Engineering", status: "active", orgId },
        { branchCode: "CIVIL", branchName: "Civil Engineering", status: "active", orgId },
        { branchCode: "IT", branchName: "Information Technology", status: "active", orgId },
        { branchCode: "AIML", branchName: "Artificial Intelligence & Machine Learning", status: "active", orgId }
      ];
      branches = await Branch.insertMany(defaultBranches);
    }

    res.status(200).json({
      success: true,
      count: branches.length,
      branches
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ success: false, message: "Error fetching college branches" });
  }
};

// 2. Create New Branch (RESTRICTED: Admin & Principal ONLY)
export const createBranch = async (req, res) => {
  try {
    if (!checkAdminOrPrincipal(req)) {
      return res.status(403).json({
        success: false,
        message: "ACCESS DENIED: Only College Admin & Principal are authorized to manage or create new branches."
      });
    }

    const { branchCode, branchName, status } = req.body;
    const Branch = getTenantBranchModel(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";

    if (!branchCode || !branchName) {
      return res.status(400).json({ success: false, message: "Branch Code and Branch Name are required." });
    }

    const cleanCode = branchCode.toString().toUpperCase().trim();
    const cleanName = branchName.toString().trim();

    const existing = await Branch.findOne({ branchCode: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Branch Code '${cleanCode}' already exists.` });
    }

    const newBranch = new Branch({
      branchCode: cleanCode,
      branchName: cleanName,
      status: status || "active",
      orgId
    });

    await newBranch.save();

    res.status(201).json({
      success: true,
      message: `Branch '${cleanCode}' created successfully`,
      branch: newBranch
    });
  } catch (error) {
    console.error("Error creating branch:", error);
    res.status(500).json({ success: false, message: "Error creating branch" });
  }
};

// 3. Update Branch (RESTRICTED: Admin & Principal ONLY)
export const updateBranch = async (req, res) => {
  try {
    if (!checkAdminOrPrincipal(req)) {
      return res.status(403).json({
        success: false,
        message: "ACCESS DENIED: Only College Admin & Principal are authorized to update branch records."
      });
    }

    const { id } = req.params;
    const { branchCode, branchName, status } = req.body;
    const Branch = getTenantBranchModel(req);

    const updateData = {};
    if (branchCode) updateData.branchCode = branchCode.toString().toUpperCase().trim();
    if (branchName) updateData.branchName = branchName.toString().trim();
    if (status) updateData.status = status;

    const updated = await Branch.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      branch: updated
    });
  } catch (error) {
    console.error("Error updating branch:", error);
    res.status(500).json({ success: false, message: "Error updating branch" });
  }
};

// 4. Delete Branch (RESTRICTED: Admin & Principal ONLY)
export const deleteBranch = async (req, res) => {
  try {
    if (!checkAdminOrPrincipal(req)) {
      return res.status(403).json({
        success: false,
        message: "ACCESS DENIED: Only College Admin & Principal are authorized to delete branches."
      });
    }

    const { id } = req.params;
    const Branch = getTenantBranchModel(req);

    const deleted = await Branch.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    res.status(200).json({
      success: true,
      message: "Branch deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting branch:", error);
    res.status(500).json({ success: false, message: "Error deleting branch" });
  }
};
