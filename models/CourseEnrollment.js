import mongoose from "mongoose";

const courseEnrollmentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    studentEmail: {
      type: String,
      required: true,
      index: true
    },
    studentName: {
      type: String,
      default: "Student"
    },
    courseId: {
      type: String,
      required: true,
      index: true
    },
    courseTitle: {
      type: String,
      required: true
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["Enrolled", "In-Progress", "Completed"],
      default: "Enrolled"
    },
    completedTopics: {
      type: [String],
      default: []
    },
    progressPercentage: {
      type: Number,
      default: 0
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now
    },
    completionDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index to ensure unique enrollment per student and course
courseEnrollmentSchema.index({ studentEmail: 1, courseId: 1 }, { unique: true });

const CourseEnrollment = mongoose.model(
  "CourseEnrollment",
  courseEnrollmentSchema,
  "course_enrollments"
);

export default CourseEnrollment;
