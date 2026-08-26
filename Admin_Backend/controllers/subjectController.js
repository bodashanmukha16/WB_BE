import getTenantContext from "../../utils/tenantConnectionManager.js";

const getTenantSubjectModel = (req) => {
  if (req.tenantModels && req.tenantModels.Subject) {
    return req.tenantModels.Subject;
  }
  const orgId = req.headers["x-tenant-id"] || req.tenantId || "svck";
  return getTenantContext(orgId).models.Subject;
};

// Fetch Subjects (filtered by department, year, semester)
export const getSubjects = async (req, res) => {
  try {
    const { department, year, semester } = req.query;
    const TenantSubject = getTenantSubjectModel(req);
    const filter = {};

    const queryRole = (req.query.role || req.headers["x-user-role"] || req.headers["x-staff-role"] || req.userRole || req.staffUser?.role || "admin").toString().toLowerCase().trim();
    const queryDept = (req.headers["x-user-branch"] || req.headers["x-user-dept"] || req.headers["x-staff-dept"] || req.userDept || req.staffUser?.department || "all").toString().toLowerCase().trim();

    const isAdminOrPrincipal = queryRole === "admin" || queryRole === "principal" || queryRole === "superadmin" || (req.staffUser?.role === "admin" || req.staffUser?.role === "principal");

    if (!isAdminOrPrincipal && queryDept !== "all") {
      // HOD / Lecturer -> Strictly scope to their branch subjects!
      filter.department = new RegExp(`^${queryDept.trim()}$`, "i");
    } else if (department && department !== "all") {
      // Admin / Principal explicit dropdown filter
      filter.department = new RegExp(`^${department.trim()}$`, "i");
    }

    if (year && year !== "all") {
      filter.year = Number(year);
    }
    if (semester && semester !== "all") {
      filter.semester = Number(semester);
    }

    let subjects = await TenantSubject.find(filter).sort({ year: 1, subjectCode: 1 });

    // Fallback: If no subjects found for specific year filter, query all subjects for department
    if (subjects.length === 0 && department && department !== "all") {
      delete filter.year;
      delete filter.semester;
      subjects = await TenantSubject.find(filter).sort({ year: 1, subjectCode: 1 });
    }

    // Auto-seed comprehensive subjects for all years if subjects collection is empty
    if (subjects.length === 0) {
      const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";
      const defaultSubjects = [
        // Year 1 CSE
        { subjectCode: "CS101", subjectName: "Programming in C & Problem Solving", department: "cse", year: 1, semester: 1, type: "Theory", credits: 4, orgId },
        { subjectCode: "CS102", subjectName: "Engineering Physics & Circuits", department: "cse", year: 1, semester: 1, type: "Theory", credits: 3, orgId },
        
        // Year 2 CSE
        { subjectCode: "CS201", subjectName: "Object Oriented Programming (Java)", department: "cse", year: 2, semester: 1, type: "Theory", credits: 3, orgId },
        { subjectCode: "CS301", subjectName: "Data Structures & Algorithms", department: "cse", year: 2, semester: 1, type: "Theory", credits: 4, orgId },
        
        // Year 3 CSE
        { subjectCode: "CS302", subjectName: "Database Management Systems (DBMS)", department: "cse", year: 3, semester: 1, type: "Theory", credits: 3, orgId },
        { subjectCode: "CS303", subjectName: "DBMS Practical Lab", department: "cse", year: 3, semester: 1, type: "Lab / Practical", credits: 2, orgId },
        { subjectCode: "CS304", subjectName: "Operating Systems & Networks", department: "cse", year: 3, semester: 1, type: "Theory", credits: 4, orgId },

        // Year 4 CSE
        { subjectCode: "CS401", subjectName: "Machine Learning & Artificial Intelligence", department: "cse", year: 4, semester: 1, type: "Theory", credits: 4, orgId },
        { subjectCode: "CS402", subjectName: "Cloud Computing & DevOps", department: "cse", year: 4, semester: 1, type: "Theory", credits: 3, orgId },

        // ECE Subjects
        { subjectCode: "EC201", subjectName: "Digital Electronics", department: "ece", year: 2, semester: 1, type: "Theory", credits: 3, orgId },
        { subjectCode: "EC301", subjectName: "VLSI Design & Embedded Systems", department: "ece", year: 3, semester: 1, type: "Theory", credits: 4, orgId },

        // EEE Subjects
        { subjectCode: "EE201", subjectName: "Electrical Power Systems", department: "eee", year: 2, semester: 1, type: "Theory", credits: 4, orgId },

        // MECH Subjects
        { subjectCode: "ME301", subjectName: "Thermodynamics & Heat Transfer", department: "mech", year: 3, semester: 1, type: "Theory", credits: 4, orgId },

        // CIVIL Subjects
        { subjectCode: "CE301", subjectName: "Structural Analysis & Hydraulics", department: "civil", year: 3, semester: 1, type: "Theory", credits: 4, orgId }
      ];

      await TenantSubject.insertMany(defaultSubjects);
      subjects = await TenantSubject.find({}).sort({ year: 1, subjectCode: 1 });
    }

    // Deduplicate subjects by subjectCode + subjectName combination if needed
    const uniqueMap = new Map();
    subjects.forEach((s) => {
      const key = `${(s.subjectCode || "").trim()}_${(s.subjectName || "").trim()}`.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    });
    const uniqueSubjects = Array.from(uniqueMap.values());

    res.status(200).json({ success: true, count: uniqueSubjects.length, subjects: uniqueSubjects });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ success: false, message: "Error retrieving subjects list" });
  }
};

// Create a new Subject record
export const createSubject = async (req, res) => {
  try {
    const { subjectCode, subjectName, department, year, semester, type, credits } = req.body;
    const TenantSubject = getTenantSubjectModel(req);
    const orgId = req.tenantId || req.headers["x-tenant-id"] || "svck";

    if (!subjectCode || !subjectName || !department || !year) {
      return res.status(400).json({ success: false, message: "Subject Code, Name, Department, and Year are required" });
    }

    const newSubject = new TenantSubject({
      subjectCode: subjectCode.toUpperCase(),
      subjectName,
      department: department.toLowerCase(),
      year: Number(year),
      semester: Number(semester || 1),
      type: type || "Theory",
      credits: Number(credits || 3),
      orgId
    });

    await newSubject.save();
    res.status(201).json({ success: true, message: "Subject created successfully in Org DB", subject: newSubject });
  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).json({ success: false, message: "Error creating subject record" });
  }
};

// Update Subject record
export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const TenantSubject = getTenantSubjectModel(req);

    const updated = await TenantSubject.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    res.status(200).json({ success: true, message: "Subject updated successfully", subject: updated });
  } catch (error) {
    console.error("Error updating subject:", error);
    res.status(500).json({ success: false, message: "Error updating subject" });
  }
};

// Delete Subject record
export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const TenantSubject = getTenantSubjectModel(req);

    const deleted = await TenantSubject.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    res.status(200).json({ success: true, message: "Subject deleted successfully" });
  } catch (error) {
    console.error("Error deleting subject:", error);
    res.status(500).json({ success: false, message: "Error deleting subject" });
  }
};
