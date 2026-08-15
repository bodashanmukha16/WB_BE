import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import getSuperAdminDb from '../utils/superAdminDb.js';

export const superAdminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const { SuperAdmin } = getSuperAdminDb();
    const admin = await SuperAdmin.findOne({
      $or: [{ username: username.toLowerCase().trim() }, { email: username.toLowerCase().trim() }]
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials.' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const payload = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      fullname: admin.fullname
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '24h' });

    res.status(200).json({
      success: true,
      message: 'Super Admin Authentication Successful',
      token,
      admin: payload
    });
  } catch (error) {
    console.error('Super Admin Login Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSuperAdminProfile = async (req, res) => {
  try {
    const { SuperAdmin } = getSuperAdminDb();
    const admin = await SuperAdmin.findById(req.superAdmin.id).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSuperAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    const { SuperAdmin } = getSuperAdminDb();
    const admin = await SuperAdmin.findById(req.superAdmin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
