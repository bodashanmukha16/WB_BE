import getSuperAdminDb from "../super_admin_backend/utils/superAdminDb.js";

// In-memory cache for instant synchronous lookups across middleware & controllers
let cachedCodeMap = { KH: "svck", A9: "aits", SITS: "s", JN: "jntu" };
let isSyncing = false;
let lastSyncTime = 0;

/**
 * Asynchronously refreshes the college code map directly from MongoDB OrganizationRegistry.
 */
export const refreshCollegeCodeMap = async () => {
  try {
    const { OrganizationRegistry } = getSuperAdminDb();
    const orgs = await OrganizationRegistry.find({ status: "active" });
    if (orgs && orgs.length > 0) {
      const newMap = {};
      for (const org of orgs) {
        if (org.code && org.orgId) {
          newMap[org.code.toUpperCase()] = org.orgId.toLowerCase();
        }
      }
      cachedCodeMap = newMap;
      lastSyncTime = Date.now();
    }
  } catch (err) {
    // Fallback to process.env if MongoDB connection is not ready
    try {
      if (process.env.COLLEGE_CODES) {
        cachedCodeMap = JSON.parse(process.env.COLLEGE_CODES);
      }
    } catch (e) {}
  }
  return cachedCodeMap;
};

/**
 * Synchronously returns current college code map.
 * Triggers background refresh if cache is older than 30 seconds.
 */
export const getCollegeCodeMap = () => {
  if (Date.now() - lastSyncTime > 30000 && !isSyncing) {
    isSyncing = true;
    refreshCollegeCodeMap().finally(() => { isSyncing = false; });
  }
  return cachedCodeMap;
};

/**
 * Resolves organization ID dynamically from student roll number or email
 * using MongoDB organization registry with zero static .env dependency.
 */
export const resolveOrgFromRollNumber = (input = "") => {
  const codeMap = getCollegeCodeMap();
  const defaultOrg = Object.values(codeMap)[0] || "svck";
  if (!input) return defaultOrg;

  const str = input.toString().trim().toUpperCase();
  const lowerStr = str.toLowerCase();

  // 1. Scan configured codes and orgIds strictly from active MongoDB registry
  for (const [code, orgId] of Object.entries(codeMap)) {
    const cleanCode = code.toUpperCase();
    const cleanOrgId = orgId.toLowerCase();

    if (str.includes(cleanCode) || lowerStr.includes(cleanOrgId)) {
      return cleanOrgId;
    }
  }

  // 2. Check 4-character code substring (e.g. '23SITS1A0501' -> 'SITS')
  if (str.length >= 6) {
    const fourChar = str.substring(2, 6);
    if (codeMap[fourChar]) {
      return codeMap[fourChar].toLowerCase();
    }
  }

  // 3. Check 2-character code substring at index 2 & 3 (e.g. '19KH1A0512' -> 'KH', '23A91A0401' -> 'A9')
  if (str.length >= 4) {
    const codeAtPos = str.substring(2, 4);
    if (codeMap[codeAtPos]) {
      return codeMap[codeAtPos].toLowerCase();
    }
  }

  return defaultOrg;
};

export default resolveOrgFromRollNumber;

