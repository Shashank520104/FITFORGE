
import express from "express";

import LoggerMiddleware from "./middlewares/logger.middleware.js";
import errorMiddleware from "./middlewares/error.middleware.js";

import userRoutes from "./routes/user.routes.js";
import workoutRoutes from "./routes/workout.routes.js";

import connectDB from "./config/database.js";

const app = express();

connectDB();

app.use(LoggerMiddleware);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to FITFORGE");
});

app.get("/health", (req, res) => {
  res.json({
    status: true,
    message: "FITFORGE Server is healthy"
  });
});

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/workouts", workoutRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use(errorMiddleware);

app.listen(3000, () => {
  console.log("FITFORGE server running on port 3000");
});