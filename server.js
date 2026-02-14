
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from './routes/authRoutes.js'
import connectDB from './config/db.js';
dotenv.config();

const app = express();
app.use(cors())
app.use(express.json())
connectDB(); // connect to Mongo
app.use("/api/auth",authRoutes)

app.listen(process.env.PORT, ()=>{
    console.log(`Server Running on port ${process.env.PORT}`)
});
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "DB Connected" });
  } catch (err) {
    res.status(500).json({ status: "DB Error", error: err.message });
  }
});

