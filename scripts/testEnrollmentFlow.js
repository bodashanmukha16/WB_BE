import mongoose from "mongoose";
import dotenv from "dotenv";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";

dotenv.config();

const testFullEnrollmentFlow = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas.");

    const testStudents = [
      { username: "19KH1A0512", courseId: "web-dev-bootcamp", courseTitle: "Full-Stack Web Development" },
      { username: "23A91A0401", courseId: "ai-machine-learning-masterclass", courseTitle: "AI & Machine Learning Masterclass" }
    ];

    for (const student of testStudents) {
      console.log(`\n==================================================`);
      console.log(`🧪 Testing Enrollment Flow for Student: [${student.username}]`);
      
      const orgId = resolveOrgFromRollNumber(student.username);
      console.log(`  📍 Resolved Organization: [${orgId}] -> DB [wb_org_${orgId}]`);

      const tenantCtx = getTenantContext(orgId);
      const CourseEnrollment = tenantCtx.models.CourseEnrollment;

      // 1. Perform Enrollment
      let enrollment = await CourseEnrollment.findOne({
        userId: student.username,
        courseId: student.courseId
      });

      if (!enrollment) {
        enrollment = new CourseEnrollment({
          userId: student.username,
          studentEmail: `${student.username}@workbench.edu`,
          studentName: student.username,
          courseId: student.courseId,
          courseTitle: student.courseTitle,
          enrolledAt: new Date(),
          status: "Enrolled",
          completedTopics: [],
          progressPercentage: 0,
          lastAccessedAt: new Date()
        });
        await enrollment.save();
        console.log(`  ✅ 1. Enrolled student in course: [${student.courseId}]`);
      } else {
        console.log(`  ℹ️ 1. Student already enrolled in: [${student.courseId}]`);
      }

      // 2. Mark Topics Done (e.g. topic_1, topic_2)
      const topicsToComplete = ["topic_1", "topic_2"];
      const totalTopics = 10;
      const progress = Math.round((topicsToComplete.length / totalTopics) * 100);

      enrollment.completedTopics = topicsToComplete;
      enrollment.progressPercentage = progress;
      enrollment.status = "In-Progress";
      enrollment.lastAccessedAt = new Date();
      await enrollment.save();

      console.log(`  ✅ 2. Marked topics done. Updated Progress: ${progress}% (${topicsToComplete.join(", ")})`);

      // 3. Simulate GET /api/enrollments/user/:rollNumber
      const records = await CourseEnrollment.find({
        $or: [
          { userId: student.username },
          { studentEmail: student.username }
        ]
      });

      console.log(`  ✅ 3. Fetched enrollments count from DB [wb_org_${orgId}]: ${records.length}`);
      records.forEach(r => {
        console.log(`     - Course: "${r.courseTitle}" | Status: ${r.status} | Progress: ${r.progressPercentage}% | Topics Done: ${r.completedTopics.length}`);
      });

      if (records.length === 0) {
        console.error(`❌ TEST FAILED: 0 enrollments returned for ${student.username}!`);
      } else {
        console.log(`🎉 TEST PASSED FOR ${student.username}! State persistent in DB [wb_org_${orgId}].`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Test error:", error.message);
    process.exit(1);
  }
};

testFullEnrollmentFlow();
