import bcrypt from 'bcrypt';
import getSuperAdminDb from './superAdminDb.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initSuperAdminDatabase = async () => {
  try {
    const { SuperAdmin, OrganizationRegistry, Course, Compiler, Software } = getSuperAdminDb();

    // 1. Seed Default Super Admin Account if none exists
    const existingAdmin = await SuperAdmin.findOne({
      $or: [{ username: 'superadmin' }, { email: 'superadmin@workbench.com' }]
    });

    if (!existingAdmin) {
      const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(defaultPassword, salt);

      await SuperAdmin.create({
        username: 'superadmin',
        email: process.env.SUPERADMIN_EMAIL || 'superadmin@workbench.com',
        password: passwordHash,
        fullname: 'System Super Administrator',
        role: 'superadmin'
      });
      console.log('✅ Default Super Admin Account Seeded (user: superadmin, pass: SuperAdmin@123)');
    }

    // 2. Seed Default Initial Organizations if OrganizationRegistry is completely empty
    const existingOrgCount = await OrganizationRegistry.countDocuments();

    if (existingOrgCount === 0) {
      console.log('🏛️ Initializing default institutions in OrganizationRegistry...');
      const defaultOrgs = {
        svck: { name: 'SV College of Engineering', code: 'KH', logo: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80' },
        aits: { name: 'AITS Rajampet', code: 'AITS', logo: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80' }
      };

      for (const [orgId, details] of Object.entries(defaultOrgs)) {
        const cleanOrgId = orgId.toLowerCase().trim();
        await OrganizationRegistry.create({
          orgId: cleanOrgId,
          name: details.name,
          code: details.code,
          logo: details.logo,
          dbName: `wb_org_${cleanOrgId}`,
          status: 'active',
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        });
        console.log(`🏛️ Initialized Organization Registry for: [${cleanOrgId}] -> DB [wb_org_${cleanOrgId}]`);
      }
    }

    // 3. Seed Courses into Superadmin Database if empty
    const courseCount = await Course.countDocuments();
    if (courseCount === 0) {
      console.log('📚 Initializing Courses in Super Admin Database...');
      const dataDir = path.resolve(__dirname, '../../../FE/FE_WB/src/Data');
      const allCoursesPath = path.join(dataDir, 'courses', 'all_courses.json');

      if (fs.existsSync(allCoursesPath)) {
        const catalog = JSON.parse(fs.readFileSync(allCoursesPath, 'utf-8'));
        const defaultBranches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML', 'AIDS', 'CSM'];
        const defaultYears = ['1', '2', '3', '4'];
        const defaultOrgs = ['svck', 'aits'];

        for (const item of catalog) {
          let details = {};
          const detailPath = path.join(dataDir, 'courses', item.dataFile || `${item.id.replace(/-/g, '_')}.json`);
          if (fs.existsSync(detailPath)) {
            try {
              details = JSON.parse(fs.readFileSync(detailPath, 'utf-8'));
            } catch (err) {
              console.warn(`Could not parse course detail file: ${detailPath}`);
            }
          }

          const formattedModules = (details.modules || []).map(m => ({
            id: m.id || m.title,
            title: m.title || '',
            duration: m.duration || '',
            topics: (m.topics || m.lessons || []).map(t => {
              const yId = t.youtubeId || t.videoId || '';
              const vUrl = t.videoUrl || (yId ? `https://www.youtube.com/embed/${yId}` : '');
              return {
                id: t.id || t.title,
                title: t.title || '',
                duration: t.duration || '',
                videoUrl: vUrl,
                youtubeId: yId,
                videoId: yId,
                summary: t.summary || '',
                cheatSheet: t.cheatSheet || []
              };
            })
          }));

          await Course.create({
            courseId: item.id,
            title: item.title,
            category: item.category || 'Programming',
            level: item.level || 'Beginner to Advanced',
            duration: item.duration || '40 hours',
            rating: item.rating || 4.8,
            reviewsCount: item.reviewsCount || 100,
            price: item.price || 'Free',
            instructor: item.instructor || 'Expert Instructor',
            instructorRole: item.instructorRole || 'Senior Technical Educator',
            badge: item.badge || 'Featured',
            icon: item.icon || 'fas fa-graduation-cap',
            color: item.color || 'from-blue-500 to-indigo-600',
            gradient: item.gradient || 'from-blue-600 to-indigo-600',
            description: item.description || '',
            overview: details.overview || item.description || '',
            learningOutcomes: details.learningOutcomes || [],
            modules: formattedModules,
            organizationProvisions: [],
            assignedOrganizations: [],
            assignedBranches: [],
            assignedYears: [],
            isPublished: true
          });
        }
        console.log(`✅ Seeded ${catalog.length} courses with full multi-org/branch/year provisions in Super Admin DB.`);
      }
    }

    // 4. Seed Compilers into Superadmin Database if empty
    const compilerCount = await Compiler.countDocuments();
    if (compilerCount === 0) {
      console.log('⚡ Initializing Compilers in Super Admin Database...');
      const compilersPath = path.resolve(__dirname, '../../../FE/FE_WB/src/Data/compilers.json');
      if (fs.existsSync(compilersPath)) {
        const compilersData = JSON.parse(fs.readFileSync(compilersPath, 'utf-8'));
        for (const c of compilersData) {
          await Compiler.create({
            compilerId: c.id,
            name: c.name,
            language: c.language,
            category: c.category || 'Core',
            icon: c.icon || 'fa-code',
            color: c.color || 'from-blue-500 to-blue-700',
            url: c.url,
            description: c.description || '',
            isPublic: true
          });
        }
        console.log(`✅ Seeded ${compilersData.length} compilers in Super Admin DB.`);
      }
    }

    // 5. Seed Softwares into Superadmin Database if empty
    const softwareCount = await Software.countDocuments();
    if (softwareCount === 0) {
      console.log('💻 Initializing Softwares in Super Admin Database...');
      const softwaresPath = path.resolve(__dirname, '../../../FE/FE_WB/src/Data/Softwares.json');
      if (fs.existsSync(softwaresPath)) {
        const softwaresData = JSON.parse(fs.readFileSync(softwaresPath, 'utf-8'));
        for (const s of softwaresData) {
          await Software.create({
            softwareId: s.id,
            name: s.name,
            language: s.language || '',
            category: s.category || 'Tools',
            icon: s.icon || 'fa-download',
            color: s.color || 'from-blue-500 to-blue-700',
            url: s.url,
            description: s.description || '',
            isPublic: true
          });
        }
        console.log(`✅ Seeded ${softwaresData.length} softwares in Super Admin DB.`);
      }
    }

  } catch (error) {
    console.error('❌ Super Admin DB Init Failed:', error.message);
  }
};

export default initSuperAdminDatabase;

