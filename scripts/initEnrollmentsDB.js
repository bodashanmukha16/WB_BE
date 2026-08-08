import mongoose from "mongoose";
import dotenv from "dotenv";
import CourseEnrollment from "../models/CourseEnrollment.js";

dotenv.config();

const initEnrollmentsDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in process.env");
    }

    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected successfully.");

    // Sync schema indexes with MongoDB collection
    console.log("Creating/Syncing Mongoose schema indexes for 'course_enrollments' collection...");
    await CourseEnrollment.syncIndexes();
    console.log("✅ Collection indexes synchronized successfully.");

    // Check count of existing enrollment documents
    const count = await CourseEnrollment.countDocuments();
    console.log(`Current document count in 'course_enrollments': ${count}`);

    if (count === 0) {
      console.log("Seeding sample enrollment entries into Mongoose database...");
      const sampleData = [
        {
          userId: "student_01",
          studentEmail: "student@workbench.edu",
          studentName: "Shanmukha Boda",
          courseId: "web-dev-bootcamp",
          courseTitle: "Full-Stack Web Development Bootcamp",
          enrolledAt: new Date(),
          status: "In-Progress",
          completedTopics: ["html-semantic"],
          progressPercentage: 17,
          lastAccessedAt: new Date()
        },
        {
          userId: "student_01",
          studentEmail: "student@workbench.edu",
          studentName: "Shanmukha Boda",
          courseId: "dsa-algorithms",
          courseTitle: "Data Structures & Algorithms in Depth",
          enrolledAt: new Date(),
          status: "Enrolled",
          completedTopics: [],
          progressPercentage: 0,
          lastAccessedAt: new Date()
        }
      ];

      await CourseEnrollment.insertMany(sampleData);
      console.log("✅ Sample enrollment data inserted successfully!");
    } else {
      console.log("ℹ️ Mongoose collection 'course_enrollments' already exists and contains data.");
    }

    console.log("🎉 Mongoose CourseEnrollment collection setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing Mongoose model:", error.message);
    process.exit(1);
  }
};

initEnrollmentsDatabase();
