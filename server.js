
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from './routes/authRoutes.js'
import enrollmentRoutes from './routes/enrollmentRoutes.js'
import examRoutes from './routes/examRoutes.js'
import adminRoutes from './Admin_Backend/routes/adminRoutes.js'
import superAdminRoutes from './super_admin_backend/routes/superAdminRoutes.js'
import connectDB from './config/db.js';
import { tenantMiddleware } from './middleware/tenantMiddleware.js';
import initSuperAdminDatabase from './super_admin_backend/utils/initSuperAdmin.js';

dotenv.config();

const app = express();
app.use(cors())
app.use(express.json())

// Connect to Mongo and initialize Super Admin DB
connectDB().then(() => {
  initSuperAdminDatabase();
});

// Mount Enterprise Multi-Tenant Middleware globally
app.use(tenantMiddleware);

app.use("/api/auth", authRoutes)
app.use("/api/enrollments", enrollmentRoutes)
app.use("/api/exams", examRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/superadmin", superAdminRoutes)

app.listen(process.env.PORT, () => {
    console.log(`Server Running on port ${process.env.PORT}`)
});

app.get("/health", async (req, res) => {
  try {
    res.status(200).json({ status: "ServerRunning"})
  } catch (err) {
    res.status(500).json({ status: "Not Running"})
  }
});
