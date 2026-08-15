import jwt from "jsonwebtoken";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import { resolveOrgFromRollNumber } from "../utils/rollNumberResolver.js";

/**
 * Express middleware to identify college organization dynamically.
 * Priority:
 * 1. Explicit request header `x-tenant-id` (Highest Priority)
 * 2. Decoded JWT bearer token claims
 * 3. Username/roll number in request body (if valid roll number)
 * 4. Roll number in request URL path (only if valid roll number format)
 * 5. Default fallback
 */
export const tenantMiddleware = (req, res, next) => {
  try {
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
      // Only resolve if segment is a valid 10-char roll number (e.g. 19KH1A0512 or 23A91A0401)
      if (lastSegment && lastSegment.length >= 8 && /^[0-9]{2}[A-Za-z0-9]{2}[0-9]/i.test(lastSegment)) {
        tenantId = resolveOrgFromRollNumber(lastSegment);
      }
    }

    // 5. Default fallback
    if (!tenantId) {
      tenantId = "svck";
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
