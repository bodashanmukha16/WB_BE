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
  if (!input) return "jntuk";

  const str = input.toString().trim().toUpperCase();
  const codeMap = getCollegeCodeMap();

  // 1. Extract 2-char code at index 2 & 3 (e.g. '19KH1A0512' -> 'KH')
  if (str.length >= 4) {
    const codeAtPos = str.substring(2, 4);
    if (codeMap[codeAtPos]) {
      return codeMap[codeAtPos];
    }
  }

  // 2. Scan if any configured code key from .env exists in string
  for (const [code, orgId] of Object.entries(codeMap)) {
    if (str.includes(code)) {
      return orgId;
    }
  }

  // Fallback to first orgId in env or default 'jntuk'
  const firstConfiguredOrg = Object.values(codeMap)[0];
  return firstConfiguredOrg || "jntuk";
};

export default resolveOrgFromRollNumber;
