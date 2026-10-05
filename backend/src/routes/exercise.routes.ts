import { Router } from "express";
import Exercise from "../models/exercise.model.js";

const router = Router();

router.post("/", async (req, res) => {
  const exercise = await Exercise.create(req.body);

  res.status(201).json({
    success: true,
    message: "Exercise created successfully",
    data: exercise
  });
});

export default router;