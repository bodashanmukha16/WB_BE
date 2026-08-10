
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from './routes/authRoutes.js'
import enrollmentRoutes from './routes/enrollmentRoutes.js'
import examRoutes from './routes/examRoutes.js'
import connectDB from './config/db.js';
import { tenantMiddleware } from './middleware/tenantMiddleware.js';
dotenv.config();

const app = express();
app.use(cors())
app.use(express.json())
connectDB(); // connect to Mongo

// Mount Enterprise Multi-Tenant Middleware globally
app.use(tenantMiddleware);

app.use("/api/auth",authRoutes)
app.use("/api/enrollments", enrollmentRoutes)
app.use("/api/exams", examRoutes)


app.listen(process.env.PORT, ()=>{
    console.log(`Server Running on port ${process.env.PORT}`)
});
app.get("/health", async (req, res) => {
  try {
    res.status(200).json({ status: "ServerRunning"})
  } catch (err) {
    res.status(500).json({ status: "Not Running"})
  }
});

