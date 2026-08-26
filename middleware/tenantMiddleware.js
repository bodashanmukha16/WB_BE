import jwt from "jsonwebtoken";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber, getCollegeCodeMap } from "../utils/rollNumberResolver.js";
import getSuperAdminDb from "../super_admin_backend/utils/superAdminDb.js";
import { getCache, setCache } from "../config/cacheManager.js";

/**
 * Express middleware to identify college organization dynamically and enforce subscription validity.
 * Blocks access with HTTP 403 if institution is suspended or expired.
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    // Skip validity checks for Super Admin routes & health check endpoint
    if (req.originalUrl.startsWith('/api/superadmin') || req.originalUrl === '/health') {
      return next();
    }

    let tenantId = null;

    // 1. Resolve from explicit request header (Highest Priority)
    if (req.headers["x-tenant-id"] && req.headers["x-tenant-id"] !== "undefined" && req.headers["x-tenant-id"] !== "null") {
      tenantId = req.headers["x-tenant-id"];
    }

    // 2. Decode JWT Bearer Token if present
    if (!tenantId && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
        if (decoded && decoded.orgId) {
          tenantId = decoded.orgId;
        }
      } catch (e) {
        // Token invalid or expired
      }
    }

    // 3. Check request body identifiers if username/roll number/email
    if (!tenantId && req.body) {
      const userIdentifier = req.body.username || req.body.userId || req.body.studentEmail || req.body.emailOrStaffId || req.body.email;
      if (userIdentifier && userIdentifier.length >= 2) {
        tenantId = resolveOrgFromRollNumber(userIdentifier);
      }
    }

    // 4. Extract roll number from request URL path ONLY if it matches a student roll number pattern
    if (!tenantId && req.originalUrl) {
      const urlSegments = req.originalUrl.split("?")[0].split("/");
      const lastSegment = urlSegments[urlSegments.length - 1];
      if (lastSegment && lastSegment.length >= 4) {
        tenantId = resolveOrgFromRollNumber(lastSegment);
      }
    }

    // 5. Default fallback
    if (!tenantId) {
      tenantId = "svck";
    }

    const cleanTenantId = tenantId.toString().toLowerCase().trim();

    // Map 2-letter college code to clean orgId (e.g. 'kh' -> 'svck', 'a9' -> 'aits', 'sits' -> 's')
    const codeMap = getCollegeCodeMap();
    const resolvedOrgId = (codeMap[cleanTenantId.toUpperCase()] || cleanTenantId).toLowerCase().trim();

    // 6. ENFORCE VALIDITY CHECK IN SUPER ADMIN ORGANIZATION REGISTRY (with Redis Cache Acceleration)
    try {
      const cacheKey = `org_validity:${resolvedOrgId}`;
      let orgRecord = await getCache(cacheKey);

      if (!orgRecord) {
        const { OrganizationRegistry } = getSuperAdminDb();
        
        // Flexible query matching orgId, code, or dbName
        const dbRecord = await OrganizationRegistry.findOne({
          $or: [
            { orgId: resolvedOrgId },
            { orgId: cleanTenantId },
            { code: cleanTenantId.toUpperCase() },
            { code: resolvedOrgId.toUpperCase() },
            { dbName: `wb_org_${resolvedOrgId}` },
            { dbName: `wb_org_${cleanTenantId}` }
          ]
        }).lean();

        if (dbRecord) {
          orgRecord = dbRecord;
          await setCache(cacheKey, dbRecord, 600); // 10 minutes cache TTL
        }
      }

      if (orgRecord) {
        const now = new Date();
        
        // CHECK 1: SUSPENDED STATUS
        if (orgRecord.status === 'suspended') {
          console.warn(`⛔ ACCESS BLOCKED: Institution '${orgRecord.name}' [${orgRecord.orgId}] is SUSPENDED.`);
          return res.status(403).json({
            success: false,
            error: "ORGANIZATION_SUSPENDED",
            message: `Institution '${orgRecord.name}' subscription is currently SUSPENDED. Access to portal & student records is blocked. Please contact Super Admin.`
          });
        }

        // CHECK 2: EXPIRED STATUS OR EXPIRATION DATE PASSED
        if (orgRecord.status === 'expired' || (orgRecord.validUntil && new Date(orgRecord.validUntil) < now)) {
          console.warn(`⛔ ACCESS BLOCKED: Institution '${orgRecord.name}' [${orgRecord.orgId}] subscription EXPIRED on ${orgRecord.validUntil}.`);
          return res.status(403).json({
            success: false,
            error: "SUBSCRIPTION_EXPIRED",
            message: `Institution '${orgRecord.name}' subscription expired on ${new Date(orgRecord.validUntil).toLocaleDateString()}. Access to portal & student records is blocked. Please contact Super Admin to renew.`
          });
        }
      }
    } catch (dbErr) {
      console.error("Validity check DB query error:", dbErr.message);
    }

    // Set Tenant Context on Request Object
    const tenantContext = getTenantContext(resolvedOrgId);

    req.tenantId = tenantContext.tenantId;
    req.dbName = tenantContext.dbName;
    req.tenantModels = tenantContext.models;

    next();
  } catch (error) {
    console.error("Multi-tenant middleware error:", error);
    next();
  }
};
