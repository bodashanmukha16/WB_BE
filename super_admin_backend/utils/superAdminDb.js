import mongoose from 'mongoose';
import dotenv from 'dotenv';
import superAdminSchema from '../models/SuperAdmin.js';
import organizationRegistrySchema from '../models/OrganizationRegistry.js';

dotenv.config();

let superAdminDb = null;
let SuperAdminModel = null;
let OrganizationRegistryModel = null;

export const getSuperAdminDb = () => {
  if (superAdminDb) {
    return {
      db: superAdminDb,
      SuperAdmin: SuperAdminModel,
      OrganizationRegistry: OrganizationRegistryModel
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

  return {
    db: superAdminDb,
    SuperAdmin: SuperAdminModel,
    OrganizationRegistry: OrganizationRegistryModel
  };
};

export default getSuperAdminDb;
