import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
import User from "../models/User.js"; // ⚠ correct import

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Mongo returns document or null
    const user = await User.findOne({ username });
    console.log(user);
    if (!user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    const token = generateToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name:user.fullname
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Server error"
    });
  }
};
