import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  branchCode: { type: String, required: true, uppercase: true, trim: true }, // e.g. CSE, ECE, EEE, MECH, CIVIL, IT, AIML, AIDS, CSM
  branchName: { type: String, required: true, trim: true }, // e.g. Computer Science & Engineering
  status: { type: String, default: "active" }, // active, inactive
  orgId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Branch = mongoose.model("Branch", branchSchema);
export default Branch;
