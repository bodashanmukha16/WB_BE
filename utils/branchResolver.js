/**
 * Helper to resolve student academic branch (e.g. 'cse', 'ece', 'eee', 'mech', 'civil', 'it', 'aiml')
 * from student username, roll number, email, or explicit branch string.
 */
export const resolveStudentBranch = (input = "") => {
  if (!input) return "cse";

  const str = input.toString().trim().toUpperCase();

  // 1. Direct branch text matching
  if (str.includes("CSE") || str.includes("COMPUTER")) return "cse";
  if (str.includes("ECE") || str.includes("ELECTRONICS")) return "ece";
  if (str.includes("EEE") || str.includes("ELECTRICAL")) return "eee";
  if (str.includes("MECH") || str.includes("MECHANICAL")) return "mech";
  if (str.includes("CIVIL")) return "civil";
  if (str.includes("IT") || str.includes("INFORMATION")) return "it";
  if (str.includes("AIML") || str.includes("AIDS") || str.includes("ARTIFICIAL")) return "aiml";

  // 2. Roll Number Branch Code matching (e.g. '19KH1A0512' -> index 6,7 is '05')
  // JNTU / Autonomous Roll Number standard: YY COLLEGE CODE 1A BRANCH_CODE XX
  if (str.length >= 8) {
    const branchCode = str.substring(6, 8);
    switch (branchCode) {
      case "05":
        return "cse";
      case "04":
        return "ece";
      case "03":
        return "eee";
      case "02":
        return "mech";
      case "01":
        return "civil";
      case "12":
        return "it";
      case "42":
      case "44":
      case "54":
        return "aiml";
      default:
        break;
    }
  }

  return "cse";
};

export default resolveStudentBranch;
