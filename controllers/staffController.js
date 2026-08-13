import StaffUser from "../models/StaffUser.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Staff Login for Admin, Principal, HOD, and Lecturers
export const staffLogin = async (req, res) => {
  try {
    const { emailOrStaffId, password } = req.body;

    if (!emailOrStaffId || !password) {
      return res.status(400).json({ success: false, message: "Email/Staff ID and password are required" });
    }

    const staff = await StaffUser.findOne({
      $or: [
        { email: emailOrStaffId.toLowerCase() },
        { staffId: emailOrStaffId.toUpperCase() },
        { email: emailOrStaffId }
      ]
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff account not found" });
    }

    // Verify Password (bcrypt or direct match fallback for seeded accounts)
    let isMatch = false;
    if (staff.password.startsWith("$2b$") || staff.password.startsWith("$2a$")) {
      isMatch = await bcrypt.compare(password, staff.password);
    } else {
      isMatch = staff.password === password;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: staff._id,
        staffId: staff.staffId,
        role: staff.role,
        department: staff.department,
        orgId: staff.orgId
      },
      process.env.JWT_SECRET || "antigravity_secret_key",
      { expiresIn: "7d" }
    );

    const staffObj = staff.toObject();
    delete staffObj.password;

    res.status(200).json({
      success: true,
      message: `Welcome back, ${staff.fullname} (${staff.role.toUpperCase()})`,
      token,
      staff: staffObj
    });
  } catch (error) {
    console.error("Error in staff login:", error);
    res.status(500).json({ success: false, message: "Server error during staff login" });
  }
};

// Get All Staff Members (Admin / Principal / HOD view)
export const getAllStaff = async (req, res) => {
  try {
    const { department, role } = req.query;
    const filter = {};

    if (department && department !== "all") {
      filter.department = department.toLowerCase();
    }

    if (role && role !== "all") {
      filter.role = role.toLowerCase();
    }

    const staffList = await StaffUser.find(filter).select("-password").sort({ fullname: 1 });
    res.status(200).json({ success: true, count: staffList.length, staff: staffList });
  } catch (error) {
    console.error("Error fetching staff list:", error);
    res.status(500).json({ success: false, message: "Error fetching staff records" });
  }
};

// Create New Staff Member (Admin / Principal / HOD)
export const createStaff = async (req, res) => {
  try {
    const { staffId, fullname, email, password, role, department, assignedSubjects, phone } = req.body;

    const existing = await StaffUser.findOne({ $or: [{ email: email.toLowerCase() }, { staffId: staffId.toUpperCase() }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "Staff ID or Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password || "College@123", 10);

    const newStaff = new StaffUser({
      staffId: staffId.toUpperCase(),
      fullname,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "lecturer",
      department: department ? department.toLowerCase() : "cse",
      phone,
      assignedSubjects: assignedSubjects || []
    });

    await newStaff.save();
    const savedObj = newStaff.toObject();
    delete savedObj.password;

    res.status(201).json({ success: true, message: "Staff account created successfully", staff: savedObj });
  } catch (error) {
    console.error("Error creating staff:", error);
    res.status(500).json({ success: false, message: "Error creating staff account" });
  }
};

// Update Staff Member
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const updatedStaff = await StaffUser.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
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
    const deleted = await StaffUser.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Staff record not found" });
    }
    res.status(200).json({ success: true, message: "Staff record deleted successfully" });
  } catch (error) {
    console.error("Error deleting staff:", error);
    res.status(500).json({ success: false, message: "Error deleting staff record" });
  }
};
