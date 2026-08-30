import getTenantContext from "../../utils/tenantConnectionManager.js";

const getTenantNotificationModel = (req) => {
  if (req.tenantModels && req.tenantModels.Notification) {
    return req.tenantModels.Notification;
  }
  const orgId = (req.headers["x-tenant-id"] || req.tenantId || req.query.orgId || "svck").toLowerCase().trim();
  const ctx = getTenantContext(orgId);
  return ctx.models.Notification;
};

// 1. Fetch All Notifications / Updates for Organization (with branch, year, category filters)
export const getNotifications = async (req, res) => {
  try {
    const Notification = getTenantNotificationModel(req);
    const { category, department, year } = req.query;

    const filter = {};
    if (category && category !== "All" && category !== "all") {
      filter.category = new RegExp(`^${category.trim()}$`, "i");
    }

    if (department && department !== "all") {
      const cleanDept = department.trim().toLowerCase();
      filter.$or = [
        { department: "all" },
        { departments: "all" },
        { department: new RegExp(`^${cleanDept}$`, "i") },
        { departments: cleanDept }
      ];
    }

    if (year && year !== "all") {
      const cleanYr = String(year).trim();
      const numericYr = cleanYr.replace(/[^0-9]/g, "");
      const yearConditions = [{ year: "all" }, { year: cleanYr }];
      if (numericYr) {
        yearConditions.push({ year: numericYr });
      }
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: yearConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = yearConditions;
      }
    }

    let notifications = await Notification.find(filter).sort({ createdAt: -1 });

    // Fallback seed if 0 items in database
    if (!notifications || notifications.length === 0) {
      const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();
      const defaultAnnouncements = [
        {
          title: `${orgId.toUpperCase()} Academic Calendar & Semester Examination Schedule`,
          description: `Official announcement: End semester examination schedules and lab evaluation guidelines have been published for all departments.`,
          category: "Exams",
          department: "all",
          departments: ["all"],
          year: "all",
          priority: "urgent",
          isNew: true,
          createdBy: "Office of Controller of Examinations",
          orgId
        },
        {
          title: "Campus Placement Drive & Technical Skill Workshops",
          description: "Special training sessions on Data Structures, Algorithms, and System Design are scheduled for 3rd and 4th-year students.",
          category: "Events",
          department: "all",
          departments: ["all"],
          year: "all",
          priority: "high",
          isNew: true,
          createdBy: "Training & Placement Cell",
          orgId
        }
      ];
      notifications = await Notification.insertMany(defaultAnnouncements);
    }

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Error retrieving notifications" });
  }
};

// 2. Create New Notification / Announcement (Admin & Staff)
export const createNotification = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      department,
      departments,
      year,
      priority,
      attachment,
      createdBy
    } = req.body;

    const Notification = getTenantNotificationModel(req);
    const orgId = (req.headers["x-tenant-id"] || req.tenantId || "svck").toLowerCase().trim();

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and Description are required." });
    }

    let parsedDepts = [];
    if (Array.isArray(departments) && departments.length > 0) {
      parsedDepts = departments.map((d) => d.toString().toLowerCase().trim());
    } else if (typeof department === "string" && department.trim().length > 0) {
      parsedDepts = department.split(",").map((d) => d.toLowerCase().trim());
    } else {
      parsedDepts = ["all"];
    }

    const primaryDept = parsedDepts.includes("all") ? "all" : (parsedDepts[0] || "all");

    const newNotification = new Notification({
      title: title.trim(),
      description: description.trim(),
      category: category || "Academic",
      department: primaryDept,
      departments: parsedDepts,
      year: year ? String(year).trim() : "all",
      priority: priority || "normal",
      attachment: attachment || "",
      isNew: true,
      createdBy: createdBy || "College Admin",
      orgId
    });

    await newNotification.save();

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      notification: newNotification
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ success: false, message: "Error creating notification" });
  }
};

// 3. Update Notification Details
export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const Notification = getTenantNotificationModel(req);

    if (updateData.departments && Array.isArray(updateData.departments)) {
      updateData.departments = updateData.departments.map((d) => d.toString().toLowerCase().trim());
      updateData.department = updateData.departments.includes("all") ? "all" : (updateData.departments[0] || "all");
    }

    const updated = await Notification.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      notification: updated
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ success: false, message: "Error updating notification" });
  }
};

// 4. Delete Notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const Notification = getTenantNotificationModel(req);

    const deleted = await Notification.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ success: false, message: "Error deleting notification" });
  }
};
