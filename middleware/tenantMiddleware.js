import jwt from "jsonwebtoken";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";

/**
 * Express middleware to identify college organization dynamically from:
 * 1. Username/roll number in request body or URL path (e.g. '/api/enrollments/user/23A91A0401' -> A9 -> 'aits')
 * 2. Explicit request header `x-tenant-id`
 * 3. Decoded JWT bearer token claims
 */
export const tenantMiddleware = (req, res, next) => {
  try {
    let tenantId = null;

    // 1. Check request body identifiers
    if (req.body && req.body.username) {
      tenantId = resolveOrgFromRollNumber(req.body.username);
    } else if (req.body && req.body.userId) {
      tenantId = resolveOrgFromRollNumber(req.body.userId);
    } else if (req.body && req.body.studentEmail) {
      tenantId = resolveOrgFromRollNumber(req.body.studentEmail);
    }

    // 2. Extract roll number from request URL path (e.g., /api/enrollments/user/19KH1A0512)
    if (!tenantId && req.originalUrl) {
      const urlSegments = req.originalUrl.split("?")[0].split("/");
      const lastSegment = urlSegments[urlSegments.length - 1];
      if (lastSegment && lastSegment !== "enrollments" && lastSegment !== "user" && lastSegment !== "enroll" && lastSegment !== "progress") {
        tenantId = resolveOrgFromRollNumber(lastSegment);
      }
    }

    // 3. Resolve from explicit request header
    if (!tenantId && req.headers["x-tenant-id"]) {
      tenantId = req.headers["x-tenant-id"];
    }

    // 4. Decode JWT Bearer Token if present
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

    // 5. Default fallback
    if (!tenantId) {
      tenantId = "jntuk";
    }

    const cleanTenantId = tenantId.toString().toLowerCase().trim();
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
