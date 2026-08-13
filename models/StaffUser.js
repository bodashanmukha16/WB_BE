import mongoose from "mongoose";

const staffUserSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      required: true,
      index: true
    },
    fullname: {
      type: String,
      required: true
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
    role: {
      type: String,
      enum: ["admin", "principal", "hod", "lecturer"],
      required: true,
      default: "lecturer"
    },
    department: {
      type: String,
      default: "all",
      lowercase: true,
      trim: true
    },
    phone: String,
    assignedSubjects: [
      {
        subjectCode: String,
        subjectName: String,
        year: Number,
        semester: Number,
        section: String
      }
    ],
    orgId: {
      type: String,
      default: "jntuk",
      lowercase: true,
      trim: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const StaffUser = mongoose.model("StaffUser", staffUserSchema, "staff_database");

export default StaffUser;
