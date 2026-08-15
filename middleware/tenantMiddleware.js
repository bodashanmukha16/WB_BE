import jwt from "jsonwebtoken";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";
import getSuperAdminDb from "../super_admin_backend/utils/superAdminDb.js";

/**
 * Express middleware to identify college organization dynamically and enforce validity.
 * Priority:
 * 1. Explicit request header `x-tenant-id` (Highest Priority)
 * 2. Decoded JWT bearer token claims
 * 3. Username/roll number in request body (if valid roll number)
 * 4. Roll number in request URL path (only if valid roll number format)
 * 5. Default fallback
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    // Skip validity checks for Super Admin routes & health check
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

    // 3. Check request body identifiers if valid roll number
    if (!tenantId && req.body) {
      const userIdentifier = req.body.username || req.body.userId || req.body.studentEmail;
      if (userIdentifier && userIdentifier.length >= 8) {
        tenantId = resolveOrgFromRollNumber(userIdentifier);
      }
    }

    // 4. Extract roll number from request URL path ONLY if it matches a student roll number pattern
    if (!tenantId && req.originalUrl) {
      const urlSegments = req.originalUrl.split("?")[0].split("/");
      const lastSegment = urlSegments[urlSegments.length - 1];
      if (lastSegment && lastSegment.length >= 8 && /^[0-9]{2}[A-Za-z0-9]{2}[0-9]/i.test(lastSegment)) {
        tenantId = resolveOrgFromRollNumber(lastSegment);
      }
    }

    // 5. Default fallback
    if (!tenantId) {
      tenantId = "svck";
    }

    const cleanTenantId = tenantId.toString().toLowerCase().trim();

    // Check validity status in Super Admin Organization Registry
    try {
      const { OrganizationRegistry } = getSuperAdminDb();
      const orgRecord = await OrganizationRegistry.findOne({ orgId: cleanTenantId });
      if (orgRecord) {
        const now = new Date();
        if (orgRecord.status === 'suspended') {
          return res.status(403).json({
            success: false,
            error: "ORGANIZATION_SUSPENDED",
            message: `Institution '${orgRecord.name}' is currently suspended. Please contact Super Admin.`
          });
        }
        if (orgRecord.validUntil && new Date(orgRecord.validUntil) < now) {
          return res.status(403).json({
            success: false,
            error: "SUBSCRIPTION_EXPIRED",
            message: `Subscription for '${orgRecord.name}' expired on ${new Date(orgRecord.validUntil).toLocaleDateString()}. Please contact Super Admin to renew.`
          });
        }
      }
    } catch (e) {
      // Continue if DB check fails gracefully
    }

    const tenantContext = getTenantContext(cleanTenantId);

    req.tenantId = tenantContext.tenantId;
    req.dbName = tenantContext.dbName;
    req.tenantModels = tenantContext.models;

    next();
  } catch (error) {
    console.error("Multi-tenant middleware error:", error);
    next();
  }
};

