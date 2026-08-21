import express from 'express';
import {
  superAdminLogin,
  getSuperAdminProfile,
  updateSuperAdminPassword
} from '../controllers/superAdminAuthController.js';
import {
  getAllOrganizations,
  getOrgDetails,
  onboardOrganization,
  updateOrgValidity,
  deleteOrganization
} from '../controllers/orgManagementController.js';
import {
  getDatabasesAndCollections,
  getCollectionDocuments,
  createDocument,
  updateDocument,
  deleteDocument
} from '../controllers/dbCrudController.js';
import superAdminAuthMiddleware from '../middleware/superAdminAuthMiddleware.js';

const router = express.Router();

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

// --- UI Database CRUD Studio Routes ---
router.get('/crud/databases', superAdminAuthMiddleware, getDatabasesAndCollections);
router.get('/crud/:dbName/:collectionName', superAdminAuthMiddleware, getCollectionDocuments);
router.post('/crud/:dbName/:collectionName', superAdminAuthMiddleware, createDocument);
router.put('/crud/:dbName/:collectionName/:id', superAdminAuthMiddleware, updateDocument);
router.delete('/crud/:dbName/:collectionName/:id', superAdminAuthMiddleware, deleteDocument);

export default router;
