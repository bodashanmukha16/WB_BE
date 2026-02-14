import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: {
    type: String,
    default: "student"
  }
});

// 👇 force collection name
const User = mongoose.model("User", userSchema, "stu_database")

export default User;
