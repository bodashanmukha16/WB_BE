import getSuperAdminDb from '../utils/superAdminDb.js';

// ==========================================
// PUBLIC ENDPOINTS (STUDENT PORTAL & ANY USER)
// ==========================================

/**
 * Public Endpoint: Fetch compilers list
 * Compilers section is publicly visible to any Student user
 */
export const getPublicCompilers = async (req, res) => {
  try {
    const { Compiler } = getSuperAdminDb();
    const compilers = await Compiler.find({ isPublic: true }).sort({ compilerId: 1 });
    return res.status(200).json({
      success: true,
      count: compilers.length,
      compilers
    });
  } catch (error) {
    console.error('Error fetching public compilers:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching compilers', error: error.message });
  }
};

/**
 * Public Endpoint: Fetch softwares list
 * Softwares section is publicly visible to any Student user
 */
export const getPublicSoftwares = async (req, res) => {
  try {
    const { Software } = getSuperAdminDb();
    const softwares = await Software.find({ isPublic: true }).sort({ softwareId: 1 });
    return res.status(200).json({
      success: true,
      count: softwares.length,
      softwares
    });
  } catch (error) {
    console.error('Error fetching public softwares:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching softwares', error: error.message });
  }
};

/**
 * Helper to check if a specific student (tenantId, branch, year) has permission to access a course.
 */
export const isCourseProvisionedForStudent = (course, tenantId, branch, year) => {
  if (!tenantId) return false;

  const tId = String(tenantId).toLowerCase().trim();
  const br = String(branch || '').toUpperCase().trim();
  const yr = String(year || '').trim();

  const orgProvs = course.organizationProvisions;

  // 1. Check Granular Per-Organization Provisions Matrix
  if (Array.isArray(orgProvs) && orgProvs.length > 0) {
    const prov = orgProvs.find(p => String(p.orgId || '').toLowerCase().trim() === tId);
    if (!prov) return false; // Not provisioned for student's organization at all!

    // If rules array is configured for this org:
    if (Array.isArray(prov.rules) && prov.rules.length > 0) {
      const ruleMatch = prov.rules.some(rule => {
        const hasBranches = Array.isArray(rule.branches) && rule.branches.length > 0;
        const hasYears = Array.isArray(rule.years) && rule.years.length > 0;

        const branchMatch = !hasBranches || (br && rule.branches.includes(br));
        const yearMatch = !hasYears || (yr && rule.years.includes(yr));

        return branchMatch && yearMatch;
      });
      return ruleMatch;
    }

    // Flat branch/year check for this org (legacy/fallback)
    const hasProvBranches = Array.isArray(prov.branches) && prov.branches.length > 0;
    const hasProvYears = Array.isArray(prov.years) && prov.years.length > 0;

    const branchOk = !hasProvBranches || (br && prov.branches.includes(br));
    const yearOk = !hasProvYears || (yr && prov.years.includes(yr));

    return branchOk && yearOk;
  }

  // 2. Fallback to global assignedOrganizations array
  if (Array.isArray(course.assignedOrganizations) && course.assignedOrganizations.length > 0) {
    const orgs = course.assignedOrganizations.map(o => String(o).toLowerCase().trim());
    if (!orgs.includes(tId)) return false;

    const hasAssignedBranches = Array.isArray(course.assignedBranches) && course.assignedBranches.length > 0;
    const hasAssignedYears = Array.isArray(course.assignedYears) && course.assignedYears.length > 0;

    const branchOk = !hasAssignedBranches || (br && course.assignedBranches.map(b => String(b).toUpperCase().trim()).includes(br));
    const yearOk = !hasAssignedYears || (yr && course.assignedYears.map(y => String(y).trim()).includes(yr));

    return branchOk && yearOk;
  }

  // Course has NO assignedOrganizations AND NO organizationProvisions: unassigned, return false.
  return false;
};

/**
 * Public Endpoint: Fetch provisioned courses for a student/tenant
 * Filters strictly based on orgId (x-tenant-id or query orgId), branch, and year
 */
export const getPublicCourses = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const tenantId = (req.headers['x-tenant-id'] || req.query.orgId || req.query.tenantId || '').toLowerCase().trim();
    const branch = (req.query.branch || req.headers['x-branch'] || '').toUpperCase().trim();
    const year = String(req.query.year || req.headers['x-year'] || '').trim();

    let allCourses = await Course.find({ isPublished: true }).sort({ createdAt: -1 });

    if (!tenantId) {
      return res.status(200).json({ success: true, count: 0, courses: [] });
    }

    // Strict Granular Provision Filtering
    const provisionedCourses = allCourses.filter(course =>
      isCourseProvisionedForStudent(course, tenantId, branch, year)
    );

    return res.status(200).json({
      success: true,
      count: provisionedCourses.length,
      courses: provisionedCourses
    });
  } catch (error) {
    console.error('Error fetching public courses:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching courses', error: error.message });
  }
};

/**
 * Public Endpoint: Fetch single course details by ID with provision check
 */
export const getPublicCourseById = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const { id } = req.params;
    const tenantId = (req.headers['x-tenant-id'] || req.query.orgId || req.query.tenantId || '').toLowerCase().trim();
    const branch = (req.query.branch || req.headers['x-branch'] || '').toUpperCase().trim();
    const year = String(req.query.year || req.headers['x-year'] || '').trim();

    const course = await Course.findOne({ courseId: id.toLowerCase().trim(), isPublished: true });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check provision permissions if tenantId is supplied
    if (tenantId && !isCourseProvisionedForStudent(course, tenantId, branch, year)) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: ${course.title} is not provisioned for your organization (${tenantId.toUpperCase()}), branch (${branch || 'ALL'}), or academic year (${year || 'ALL'}).`
      });
    }

    return res.status(200).json({ success: true, course });
  } catch (error) {
    console.error('Error fetching course details:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching course details', error: error.message });
  }
};

// ==========================================
// SUPER ADMIN ENDPOINTS (AUTHENTICATED)
// ==========================================

// --- COURSES ---

export const getAllCourses = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const courses = await Course.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: courses.length, courses });
  } catch (error) {
    console.error('Superadmin getAllCourses error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
};

export const createCourse = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const courseData = req.body;

    if (!courseData.title) {
      return res.status(400).json({ success: false, message: 'Course title is required' });
    }

    const courseId = courseData.courseId || courseData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await Course.findOne({ courseId });
    if (existing) {
      return res.status(400).json({ success: false, message: `Course with ID [${courseId}] already exists.` });
    }

    const newCourse = await Course.create({
      ...courseData,
      courseId,
      organizationProvisions: courseData.organizationProvisions || [],
      assignedOrganizations: courseData.assignedOrganizations || ['svck', 'aits'],
      assignedBranches: courseData.assignedBranches || ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML', 'AIDS', 'CSM'],
      assignedYears: courseData.assignedYears || ['1', '2', '3', '4']
    });

    return res.status(201).json({ success: true, message: 'Course created successfully', course: newCourse });
  } catch (error) {
    console.error('Superadmin createCourse error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create course', error: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const { id } = req.params;
    const updateData = req.body;

    const course = await Course.findOneAndUpdate(
      { courseId: id.toLowerCase().trim() },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    return res.status(200).json({ success: true, message: 'Course updated successfully', course });
  } catch (error) {
    console.error('Superadmin updateCourse error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update course', error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const { id } = req.params;

    const result = await Course.findOneAndDelete({ courseId: id.toLowerCase().trim() });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    return res.status(200).json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Superadmin deleteCourse error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete course', error: error.message });
  }
};

/**
 * Super Admin Course Provisioning:
 * Supports granular organizationProvisions matrix with rules:
 * organizationProvisions: [
 *   {
 *     orgId: 'svck',
 *     rules: [
 *       { branches: ['CSE'], years: ['2'] },
 *       { branches: ['ECE'], years: ['1'] }
 *     ]
 *   }
 * ]
 */
export const assignCourse = async (req, res) => {
  try {
    const { Course } = getSuperAdminDb();
    const { id } = req.params;
    const { organizationProvisions, assignedOrganizations, assignedBranches, assignedYears } = req.body;

    const course = await Course.findOne({ courseId: id.toLowerCase().trim() });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (Array.isArray(organizationProvisions)) {
      course.organizationProvisions = organizationProvisions.map(p => ({
        orgId: String(p.orgId || '').toLowerCase().trim(),
        rules: Array.isArray(p.rules) ? p.rules.map(r => ({
          branches: Array.isArray(r.branches) ? r.branches.map(b => String(b).toUpperCase().trim()) : [],
          years: Array.isArray(r.years) ? r.years.map(y => String(y).trim()) : []
        })) : [],
        branches: Array.isArray(p.branches) ? p.branches.map(b => String(b).toUpperCase().trim()) : [],
        years: Array.isArray(p.years) ? p.years.map(y => String(y).trim()) : []
      }));

      // Sync flat arrays for legacy compatibility
      course.assignedOrganizations = course.organizationProvisions.map(p => p.orgId);
      const allB = new Set();
      const allY = new Set();
      course.organizationProvisions.forEach(p => {
        if (Array.isArray(p.rules)) {
          p.rules.forEach(r => {
            r.branches.forEach(b => allB.add(b));
            r.years.forEach(y => allY.add(y));
          });
        }
        if (Array.isArray(p.branches)) p.branches.forEach(b => allB.add(b));
        if (Array.isArray(p.years)) p.years.forEach(y => allY.add(y));
      });
      course.assignedBranches = Array.from(allB);
      course.assignedYears = Array.from(allY);
    } else {
      if (Array.isArray(assignedOrganizations)) {
        course.assignedOrganizations = assignedOrganizations.map(o => o.toLowerCase().trim());
      }
      if (Array.isArray(assignedBranches)) {
        course.assignedBranches = assignedBranches.map(b => b.toUpperCase().trim());
      }
      if (Array.isArray(assignedYears)) {
        course.assignedYears = assignedYears.map(y => String(y).trim());
      }
    }

    course.updatedAt = new Date();
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Course provisions updated successfully for [${course.title}]`,
      course
    });
  } catch (error) {
    console.error('Superadmin assignCourse error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign course provisions', error: error.message });
  }
};

// --- COMPILERS ---

export const getAllCompilers = async (req, res) => {
  try {
    const { Compiler } = getSuperAdminDb();
    const compilers = await Compiler.find({}).sort({ compilerId: 1 });
    return res.status(200).json({ success: true, count: compilers.length, compilers });
  } catch (error) {
    console.error('Superadmin getAllCompilers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch compilers' });
  }
};

export const createCompiler = async (req, res) => {
  try {
    const { Compiler } = getSuperAdminDb();
    const compilerData = req.body;

    if (!compilerData.name || !compilerData.url || !compilerData.language) {
      return res.status(400).json({ success: false, message: 'Name, language, and URL are required' });
    }

    // Auto calculate compilerId if not provided
    if (!compilerData.compilerId) {
      const highest = await Compiler.findOne({}).sort({ compilerId: -1 });
      compilerData.compilerId = highest ? highest.compilerId + 1 : 1;
    }

    const newCompiler = await Compiler.create(compilerData);
    return res.status(201).json({ success: true, message: 'Compiler added successfully', compiler: newCompiler });
  } catch (error) {
    console.error('Superadmin createCompiler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create compiler', error: error.message });
  }
};

export const updateCompiler = async (req, res) => {
  try {
    const { Compiler } = getSuperAdminDb();
    const { id } = req.params;
    const updateData = req.body;

    const compiler = await Compiler.findOneAndUpdate(
      { compilerId: Number(id) },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    if (!compiler) {
      return res.status(404).json({ success: false, message: 'Compiler not found' });
    }

    return res.status(200).json({ success: true, message: 'Compiler updated successfully', compiler });
  } catch (error) {
    console.error('Superadmin updateCompiler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update compiler', error: error.message });
  }
};

export const deleteCompiler = async (req, res) => {
  try {
    const { Compiler } = getSuperAdminDb();
    const { id } = req.params;

    const result = await Compiler.findOneAndDelete({ compilerId: Number(id) });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Compiler not found' });
    }

    return res.status(200).json({ success: true, message: 'Compiler deleted successfully' });
  } catch (error) {
    console.error('Superadmin deleteCompiler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete compiler', error: error.message });
  }
};

// --- SOFTWARES ---

export const getAllSoftwares = async (req, res) => {
  try {
    const { Software } = getSuperAdminDb();
    const softwares = await Software.find({}).sort({ softwareId: 1 });
    return res.status(200).json({ success: true, count: softwares.length, softwares });
  } catch (error) {
    console.error('Superadmin getAllSoftwares error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch softwares' });
  }
};

export const createSoftware = async (req, res) => {
  try {
    const { Software } = getSuperAdminDb();
    const softwareData = req.body;

    if (!softwareData.name || !softwareData.url) {
      return res.status(400).json({ success: false, message: 'Software name and URL are required' });
    }

    if (!softwareData.softwareId) {
      const highest = await Software.findOne({}).sort({ softwareId: -1 });
      softwareData.softwareId = highest ? highest.softwareId + 1 : 1;
    }

    const newSoftware = await Software.create(softwareData);
    return res.status(201).json({ success: true, message: 'Software added successfully', software: newSoftware });
  } catch (error) {
    console.error('Superadmin createSoftware error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create software', error: error.message });
  }
};

export const updateSoftware = async (req, res) => {
  try {
    const { Software } = getSuperAdminDb();
    const { id } = req.params;
    const updateData = req.body;

    const software = await Software.findOneAndUpdate(
      { softwareId: Number(id) },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    if (!software) {
      return res.status(404).json({ success: false, message: 'Software not found' });
    }

    return res.status(200).json({ success: true, message: 'Software updated successfully', software });
  } catch (error) {
    console.error('Superadmin updateSoftware error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update software', error: error.message });
  }
};

export const deleteSoftware = async (req, res) => {
  try {
    const { Software } = getSuperAdminDb();
    const { id } = req.params;

    const result = await Software.findOneAndDelete({ softwareId: Number(id) });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Software not found' });
    }

    return res.status(200).json({ success: true, message: 'Software deleted successfully' });
  } catch (error) {
    console.error('Superadmin deleteSoftware error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete software', error: error.message });
  }
};
