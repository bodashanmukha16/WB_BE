import mongoose from 'mongoose';
import dotenv from 'dotenv';
import superAdminSchema from '../models/SuperAdmin.js';
import organizationRegistrySchema from '../models/OrganizationRegistry.js';
import courseSchema from '../models/Course.js';
import compilerSchema from '../models/Compiler.js';
import softwareSchema from '../models/Software.js';

dotenv.config();

let superAdminDb = null;
let SuperAdminModel = null;
let OrganizationRegistryModel = null;
let CourseModel = null;
let CompilerModel = null;
let SoftwareModel = null;

export const getSuperAdminDb = () => {
  if (superAdminDb) {
    return {
      db: superAdminDb,
      SuperAdmin: SuperAdminModel,
      OrganizationRegistry: OrganizationRegistryModel,
      Course: CourseModel,
      Compiler: CompilerModel,
      Software: SoftwareModel
    };
  }

  const baseConn = mongoose.connection;
  if (!baseConn || baseConn.readyState !== 1) {
    throw new Error('Base Mongoose connection is not ready.');
  }

  // Connect/use dedicated database wb_super_admin
  superAdminDb = baseConn.useDb('wb_super_admin', { useCache: true });
  SuperAdminModel = superAdminDb.model('SuperAdmin', superAdminSchema, 'super_admins');
  OrganizationRegistryModel = superAdminDb.model('OrganizationRegistry', organizationRegistrySchema, 'organizations');
  CourseModel = superAdminDb.model('Course', courseSchema, 'courses');
  CompilerModel = superAdminDb.model('Compiler', compilerSchema, 'compilers');
  SoftwareModel = superAdminDb.model('Software', softwareSchema, 'softwares');

  return {
    db: superAdminDb,
    SuperAdmin: SuperAdminModel,
    OrganizationRegistry: OrganizationRegistryModel,
    Course: CourseModel,
    Compiler: CompilerModel,
    Software: SoftwareModel
  };
};

export default getSuperAdminDb;

