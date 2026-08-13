import mongoose from "mongoose";
import dotenv from "dotenv";
import StaffUser from "../models/StaffUser.js";
import connectDB from "../../config/db.js";

dotenv.config();

const seedStaffData = async () => {
  try {
    await connectDB();

    const sampleStaff = [
      {
        staffId: "ADM001",
        fullname: "System Administration",
        email: "admin@workbench.edu",
        password: "Admin@123", // Or hashed password
        role: "admin",
        department: "all",
        phone: "+91 9876543210"
      },
      {
        staffId: "PRN001",
        fullname: "Dr. V. Srinivasa Rao (Principal)",
        email: "principal@jntuk.edu.in",
        password: "Principal@123",
        role: "principal",
        department: "all",
        phone: "+91 9876543211"
      },
      {
        staffId: "HOD001",
        fullname: "Dr. K. Venkatesh (HOD - CSE)",
        email: "hod.cse@jntuk.edu.in",
        password: "Hod@123",
        role: "hod",
        department: "cse",
        phone: "+91 9876543212"
      },
      {
        staffId: "LEC001",
        fullname: "Prof. P. Suresh (Senior Lecturer)",
        email: "suresh.lec@jntuk.edu.in",
        password: "Lecturer@123",
        role: "lecturer",
        department: "cse",
        phone: "+91 9876543213",
        assignedSubjects: [
          {
            subjectCode: "CS301",
            subjectName: "Data Structures & Algorithms",
            year: 2,
            semester: 1,
            section: "A"
          },
          {
            subjectCode: "CS401",
            subjectName: "Machine Learning",
            year: 4,
            semester: 1,
            section: "B"
          }
        ]
      }
    ];

    for (const staff of sampleStaff) {
      const existing = await StaffUser.findOne({ staffId: staff.staffId });
      if (!existing) {
        await StaffUser.create(staff);
        console.log(`✅ Seeded Staff Account: ${staff.fullname} [${staff.role.toUpperCase()}]`);
      } else {
        console.log(`ℹ️ Staff Account already exists: ${staff.staffId}`);
      }
    }

    console.log("🎉 Admin Staff Database Initialization Complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding staff data:", error);
    process.exit(1);
  }
};

seedStaffData();
