import express from 'express';
import {
  superAdminLogin,
  getSuperAdminProfile,
  updateSuperAdminPassword
} from '../controllers/superAdminAuthController.js';
import {
  getPublicOrganizations,
  getAllOrganizations,
  getOrgDetails,
  onboardOrganization,
  updateOrgValidity,
  deleteOrganization,
  getOrgIpPool,
  addOrgIpPoolEntry,
  removeOrgIpPoolEntry,
  toggleOrgIpRestriction
} from '../controllers/orgManagementController.js';
import {
  getDatabasesAndCollections,
  getCollectionDocuments,
  createDocument,
  updateDocument,
  deleteDocument
} from '../controllers/dbCrudController.js';
import {
  getPublicCompilers,
  getPublicSoftwares,
  getPublicCourses,
  getPublicCourseById,
  getAllCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  assignCourse,
  getAllCompilers,
  createCompiler,
  updateCompiler,
  deleteCompiler,
  getAllSoftwares,
  createSoftware,
  updateSoftware,
  deleteSoftware
} from '../controllers/catalogManagementController.js';
import superAdminAuthMiddleware from '../middleware/superAdminAuthMiddleware.js';

const router = express.Router();

// --- Public Unauthenticated Routes (Accessible to Student FE_WB) ---
router.get('/public/organizations', getPublicOrganizations);
router.get('/public/compilers', getPublicCompilers);
router.get('/public/softwares', getPublicSoftwares);
router.get('/public/courses', getPublicCourses);
router.get('/public/courses/:id', getPublicCourseById);

// --- Auth Routes ---
router.post('/login', superAdminLogin);
router.get('/me', superAdminAuthMiddleware, getSuperAdminProfile);
router.put('/password', superAdminAuthMiddleware, updateSuperAdminPassword);

// --- Organization Management Routes ---
router.get('/organizations', superAdminAuthMiddleware, getAllOrganizations);
router.get('/organizations/:orgId', superAdminAuthMiddleware, getOrgDetails);
router.post('/organizations/onboard', superAdminAuthMiddleware, onboardOrganization);
router.put('/organizations/:orgId/validity', superAdminAuthMiddleware, updateOrgValidity);
router.delete('/organizations/:orgId', superAdminAuthMiddleware, deleteOrganization);

// --- IP Pool Management Routes ---
router.get('/organizations/:orgId/ip-pool', superAdminAuthMiddleware, getOrgIpPool);
router.post('/organizations/:orgId/ip-pool', superAdminAuthMiddleware, addOrgIpPoolEntry);
router.delete('/organizations/:orgId/ip-pool/:ipId', superAdminAuthMiddleware, removeOrgIpPoolEntry);
router.put('/organizations/:orgId/ip-toggle', superAdminAuthMiddleware, toggleOrgIpRestriction);

// --- Super Admin Catalog CRUD & Provisioning Routes ---

// Courses & Provisions
router.get('/courses', superAdminAuthMiddleware, getAllCourses);
router.post('/courses', superAdminAuthMiddleware, createCourse);
router.put('/courses/:id', superAdminAuthMiddleware, updateCourse);
router.delete('/courses/:id', superAdminAuthMiddleware, deleteCourse);
router.post('/courses/:id/assign', superAdminAuthMiddleware, assignCourse);

// Compilers
router.get('/compilers', superAdminAuthMiddleware, getAllCompilers);
router.post('/compilers', superAdminAuthMiddleware, createCompiler);
router.put('/compilers/:id', superAdminAuthMiddleware, updateCompiler);
router.delete('/compilers/:id', superAdminAuthMiddleware, deleteCompiler);

// Softwares
router.get('/softwares', superAdminAuthMiddleware, getAllSoftwares);
router.post('/softwares', superAdminAuthMiddleware, createSoftware);
router.put('/softwares/:id', superAdminAuthMiddleware, updateSoftware);
router.delete('/softwares/:id', superAdminAuthMiddleware, deleteSoftware);

// --- UI Database CRUD Studio Routes ---
router.get('/crud/databases', superAdminAuthMiddleware, getDatabasesAndCollections);
router.get('/crud/:dbName/:collectionName', superAdminAuthMiddleware, getCollectionDocuments);
router.post('/crud/:dbName/:collectionName', superAdminAuthMiddleware, createDocument);
router.put('/crud/:dbName/:collectionName/:id', superAdminAuthMiddleware, updateDocument);
router.delete('/crud/:dbName/:collectionName/:id', superAdminAuthMiddleware, deleteDocument);

export default router;

