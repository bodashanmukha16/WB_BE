import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../../config/db.js";
import getTenantContext from "../../utils/tenantConnectionManager.js";
import StaffUser from "../models/StaffUser.js";

dotenv.config();

const organizations = [
  {
    orgId: "jntuk",
    name: "JNTUK College of Engineering",
    code: "JNTUK",
    staff: [
      { staffId: "ADM001", fullname: "JNTUK System Administration", email: "admin@workbench.edu", password: "Admin@123", role: "admin", department: "all", phone: "+91 9876543210", orgId: "jntuk" },
      { staffId: "PRN001", fullname: "Dr. V. Srinivasa Rao (Principal)", email: "principal@jntuk.edu.in", password: "Principal@123", role: "principal", department: "all", phone: "+91 9876543211", orgId: "jntuk" },
      { staffId: "HOD001", fullname: "Dr. K. Venkatesh (HOD - CSE)", email: "hod.cse@jntuk.edu.in", password: "Hod@123", role: "hod", department: "cse", phone: "+91 9876543212", orgId: "jntuk" },
      { staffId: "LEC001", fullname: "Prof. P. Suresh (Lecturer)", email: "suresh.lec@jntuk.edu.in", password: "Lecturer@123", role: "lecturer", department: "cse", phone: "+91 9876543213", orgId: "jntuk" }
    ],
    sampleStudents: [
      { username: "23031A0501", fullname: "Aarav Sharma", email: "aarav.cse@jntuk.edu.in", branch: "CSE", year: 3, section: "A", orgId: "jntuk" },
      { username: "23031A0502", fullname: "Bhavya Sri", email: "bhavya.cse@jntuk.edu.in", branch: "CSE", year: 3, section: "A", orgId: "jntuk" },
      { username: "23031A0401", fullname: "Chaitanya Kumar", email: "chaitanya.ece@jntuk.edu.in", branch: "ECE", year: 3, section: "B", orgId: "jntuk" }
    ]
  },
  {
    orgId: "svck",
    name: "SVCK College of Engineering",
    code: "SVCK",
    staff: [
      { staffId: "SVCK_ADM01", fullname: "SVCK Admin Official", email: "admin@svck.edu.in", password: "Admin@123", role: "admin", department: "all", phone: "+91 9123456780", orgId: "svck" },
      { staffId: "SVCK_PRN01", fullname: "Dr. M. Rama Krishna (Principal)", email: "principal@svck.edu.in", password: "Principal@123", role: "principal", department: "all", phone: "+91 9123456781", orgId: "svck" },
      { staffId: "SVCK_HOD01", fullname: "Dr. S. Nageswara Rao (HOD - CSE)", email: "hod.cse@svck.edu.in", password: "Hod@123", role: "hod", department: "cse", phone: "+91 9123456782", orgId: "svck" },
      { staffId: "SVCK_LEC01", fullname: "Prof. K. Swathi (Senior Faculty)", email: "faculty.cse@svck.edu.in", password: "Lecturer@123", role: "lecturer", department: "cse", phone: "+91 9123456783", orgId: "svck" }
    ],
    sampleStudents: [
      { username: "23SVCK0501", fullname: "Divya Teja", email: "divya.cse@svck.edu.in", branch: "CSE", year: 3, section: "A", orgId: "svck" },
      { username: "23SVCK0502", fullname: "Eshwar Varma", email: "eshwar.cse@svck.edu.in", branch: "CSE", year: 3, section: "A", orgId: "svck" },
      { username: "23SVCK0401", fullname: "Farhan Ahmed", email: "farhan.ece@svck.edu.in", branch: "ECE", year: 2, section: "A", orgId: "svck" }
    ]
  },
  {
    orgId: "aits",
    name: "Annamacharya Institute of Technology & Sciences",
    code: "AITS",
    staff: [
      { staffId: "AITS_ADM01", fullname: "AITS Institution Admin", email: "admin@aits.edu.in", password: "Admin@123", role: "admin", department: "all", phone: "+91 9988776650", orgId: "aits" },
      { staffId: "AITS_PRN01", fullname: "Dr. N. Chandra Sekhar (Principal)", email: "principal@aits.edu.in", password: "Principal@123", role: "principal", department: "all", phone: "+91 9988776651", orgId: "aits" },
      { staffId: "AITS_HOD01", fullname: "Dr. B. Prasad (HOD - CSE)", email: "hod.cse@aits.edu.in", password: "Hod@123", role: "hod", department: "cse", phone: "+91 9988776652", orgId: "aits" },
      { staffId: "AITS_LEC01", fullname: "Prof. G. Lakshmi (Faculty)", email: "faculty.cse@aits.edu.in", password: "Lecturer@123", role: "lecturer", department: "cse", phone: "+91 9988776653", orgId: "aits" }
    ],
    sampleStudents: [
      { username: "23AITS0501", fullname: "Gautam Reddy", email: "gautam.cse@aits.edu.in", branch: "CSE", year: 3, section: "A", orgId: "aits" },
      { username: "23AITS0502", fullname: "Harini Priya", email: "harini.cse@aits.edu.in", branch: "CSE", year: 3, section: "A", orgId: "aits" },
      { username: "23AITS0301", fullname: "Indrajit Roy", email: "indrajit.mech@aits.edu.in", branch: "MECH", year: 4, section: "A", orgId: "aits" }
    ]
  }
];

const seedMultiOrgDatabase = async () => {
  try {
    await connectDB();
    console.log("🚀 Initializing Multi-Tenant College Databases in MongoDB (JNTUK, SVCK, AITS)...");

    for (const org of organizations) {
      console.log(`\n🏛️ Seeding Organization: ${org.name} [${org.code}] -> Physical DB [wb_org_${org.orgId}]`);

      const tenantCtx = getTenantContext(org.orgId);
      const TenantStaffUser = tenantCtx.models.StaffUser;
      const TenantUser = tenantCtx.models.User;
      const TenantSubject = tenantCtx.models.Subject;

      // 1. Seed Staff Accounts physically inside `wb_org_[orgId].staff_database`
      for (const st of org.staff) {
        // Also sync in main StaffUser collection for fallback
        await StaffUser.updateOne(
          { staffId: st.staffId },
          { $set: st },
          { upsert: true }
        );

        const existingStaff = await TenantStaffUser.findOne({ staffId: st.staffId });
        if (!existingStaff) {
          await TenantStaffUser.create(st);
          console.log(`  └─ ✅ Created Staff physically in [wb_org_${org.orgId}.staff_database]: ${st.fullname} [${st.role.toUpperCase()}]`);
        } else {
          await TenantStaffUser.updateOne({ staffId: st.staffId }, { $set: st });
          console.log(`  └─ ℹ️ Updated Staff in [wb_org_${org.orgId}.staff_database]: ${st.staffId}`);
        }
      }

      // 2. Seed Student Accounts physically inside `wb_org_[orgId].stu_database`
      for (const std of org.sampleStudents) {
        const existingStudent = await TenantUser.findOne({ username: std.username });
        if (!existingStudent) {
          await TenantUser.create({
            ...std,
            password: "Student@123",
            role: "student"
          });
          console.log(`  └─ 🎓 Created Student in [wb_org_${org.orgId}.stu_database]: ${std.fullname} (${std.username})`);
        }
      }

      // 3. Seed College Subjects physically inside `wb_org_[orgId].college_subjects`
      const existingSubjectsCount = await TenantSubject.countDocuments({});
      if (existingSubjectsCount === 0) {
        const defaultSubjects = [
          { subjectCode: "CS301", subjectName: "Data Structures & Algorithms", department: "cse", year: 2, semester: 1, type: "Theory", credits: 4, orgId: org.orgId },
          { subjectCode: "CS302", subjectName: "Database Management Systems (DBMS)", department: "cse", year: 3, semester: 1, type: "Theory", credits: 3, orgId: org.orgId },
          { subjectCode: "CS303", subjectName: "DBMS Practical Lab", department: "cse", year: 3, semester: 1, type: "Lab / Practical", credits: 2, orgId: org.orgId },
          { subjectCode: "CS401", subjectName: "Machine Learning & AI", department: "cse", year: 4, semester: 1, type: "Theory", credits: 4, orgId: org.orgId },
          { subjectCode: "EC201", subjectName: "Digital Electronics", department: "ece", year: 2, semester: 1, type: "Theory", credits: 3, orgId: org.orgId },
          { subjectCode: "EC301", subjectName: "VLSI Design & Embedded Systems", department: "ece", year: 3, semester: 1, type: "Theory", credits: 4, orgId: org.orgId },
          { subjectCode: "EE201", subjectName: "Electrical Power Systems", department: "eee", year: 2, semester: 1, type: "Theory", credits: 4, orgId: org.orgId },
          { subjectCode: "ME301", subjectName: "Thermodynamics & Heat Transfer", department: "mech", year: 3, semester: 1, type: "Theory", credits: 4, orgId: org.orgId },
          { subjectCode: "CE301", subjectName: "Structural Analysis & Hydraulics", department: "civil", year: 3, semester: 1, type: "Theory", credits: 4, orgId: org.orgId }
        ];

        await TenantSubject.insertMany(defaultSubjects);
        console.log(`  └─ 📚 Seeded ${defaultSubjects.length} Subjects physically in [wb_org_${org.orgId}.college_subjects]`);
      }
    }

    console.log("\n🎉 Multi-Tenant Physical Databases for JNTUK, SVCK, and AITS Successfully Seeded in MongoDB!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding multi-org databases:", error);
    process.exit(1);
  }
};

seedMultiOrgDatabase();
