import jwt from "jsonwebtoken";

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id || user._id,
      username: user.username,
      email: user.email,
      role: user.role || "student",
      orgId: user.orgId || "svck",
      organization: user.organization || "SV College of Engineering"
    },
    process.env.JWT_SECRET || "supersecretkey",
    { expiresIn: "7d" }
  );
};

export default generateToken;