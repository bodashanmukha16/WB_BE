import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true
    },
    domain: {
      type: String,
      default: ""
    },
    dbName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

const Organization = mongoose.model("Organization", organizationSchema, "organizations");

export default Organization;
