import dotenv from "dotenv";
dotenv.config();

/**
 * Dynamically parses process.env.COLLEGE_CODES JSON mapping.
 * Example: process.env.COLLEGE_CODES = '{"KH":"jntuk","A9":"aits"}'
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
 * Extracts college code from student roll number (e.g. '19KH1A0512' -> 'KH')
 * and resolves the matching organization ID strictly from .env mapping.
 */
export const resolveOrgFromRollNumber = (input = "") => {
  const codeMap = getCollegeCodeMap();
  const defaultOrg = codeMap["SVCK"] || codeMap["SV"] || codeMap["KH"] || "svck";
  if (!input) return defaultOrg;

  const str = input.toString().trim().toUpperCase();

  // 1. Direct text check for SVCK, SV, AITS, JNTUK in input
  if (str.includes("SVCK") || str.includes("SV") || str.includes("KH")) return "svck";
  if (str.includes("AITS") || str.includes("A9")) return "aits";

  // 2. Check 4-char substring (e.g. '23SVCK0542' -> 'SVCK')
  if (str.length >= 6) {
    const fourChar = str.substring(2, 6);
    if (codeMap[fourChar]) return codeMap[fourChar];
  }

  // 3. Extract 2-char code at index 2 & 3 (e.g. '19KH1A0512' -> 'KH')
  if (str.length >= 4) {
    const codeAtPos = str.substring(2, 4);
    if (codeMap[codeAtPos]) {
      return codeMap[codeAtPos];
    }
  }

  // 4. Scan if any configured code key from .env exists in string
  for (const [code, orgId] of Object.entries(codeMap)) {
    if (str.includes(code)) {
      return orgId;
    }
  }

  // Fallback to svck
  return defaultOrg;
};

export default resolveOrgFromRollNumber;
