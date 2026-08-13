import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      default: "jntuk",
      lowercase: true,
      index: true
    },
    department: {
      type: String,
      required: true,
      lowercase: true,
      index: true
    },
    year: {
      type: Number,
      required: true
    },
    semester: {
      type: Number,
      default: 1
    },
    section: {
      type: String,
      default: "A"
    },
    subjectCode: {
      type: String,
      required: true
    },
    subjectName: {
      type: String,
      required: true
    },
    facultyId: {
      type: String,
      required: true
    },
    facultyName: {
      type: String,
      required: true
    },
    date: {
      type: String,
      required: true,
      index: true
    },
    periods: {
      type: [Number], // Supports multiple periods e.g. [1, 2] for back-to-back periods or labs
      default: [1]
    },
    records: [
      {
        studentId: String,
        rollNumber: String,
        studentName: String,
        status: {
          type: String,
          enum: ["present", "absent", "late", "excused"],
          default: "present"
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

const Attendance = mongoose.model("Attendance", attendanceSchema, "attendance_records");

export default Attendance;
