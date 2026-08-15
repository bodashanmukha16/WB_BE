import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      index: true
    },
    password: {
      type: String,
      required: true
    },
    branch: String,
    fullname: String,
    orgId: {
      type: String,
      default: "svck",
      lowercase: true,
      trim: true,
      index: true
    },
    organization: {
      type: String,
      default: "SV College of Engineering"
    },
    role: {
      type: String,
      default: "student"
    },
    resetToken: String,
    resetTokenExpiry: Date
  },
  {
    timestamps: true
  }
);

// Force collection name for User model
const User = mongoose.model("User", userSchema, "stu_database");

export default User;
