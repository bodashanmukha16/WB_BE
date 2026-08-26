import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, default: "Academic" }, // Academic, Exams, Results, Events, Urgent
  department: { type: String, default: "all", lowercase: true, trim: true }, // all, cse, ece, etc.
  departments: [{ type: String, lowercase: true, trim: true }],
  year: { type: String, default: "all" }, // all, 1, 2, 3, 4
  priority: { type: String, default: "normal" }, // normal, high, urgent
  isNew: { type: Boolean, default: true },
  attachment: { type: String, default: "" }, // URL or document link
  createdBy: { type: String, default: "College Admin" },
  orgId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
