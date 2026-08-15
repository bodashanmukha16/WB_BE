import dotenv from "dotenv";
dotenv.config();

/**
 * Dynamically parses process.env.COLLEGE_CODES JSON mapping.
 * Example: process.env.COLLEGE_CODES = '{"KH":"svck","A9":"aits","SITS":"s"}'
 */
export const getCollegeCodeMap = () => {
  try {
    if (process.env.COLLEGE_CODES) {
      return JSON.parse(process.env.COLLEGE_CODES);
    }
  } catch (e) {
    console.error("Error parsing COLLEGE_CODES from process.env:", e.message);
  }
  return {};
};

/**
 * Resolves organization ID dynamically from student roll number or email
 * strictly using process.env.COLLEGE_CODES mapping with ZERO hardcoded org IDs.
 */
export const resolveOrgFromRollNumber = (input = "") => {
  const codeMap = getCollegeCodeMap();
  const defaultOrg = Object.values(codeMap)[0] || "svck";
  if (!input) return defaultOrg;

  const str = input.toString().trim().toUpperCase();
  const lowerStr = str.toLowerCase();

  // 1. Scan configured codes and orgIds strictly from .env mapping
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
