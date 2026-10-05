import { Router } from "express";

import {
  createWorkoutPlan,
  getWorkoutPlan
} from "../controllers/workoutPlan.controller.js";

const router = Router();

router.post("/", createWorkoutPlan);

router.get("/:id", getWorkoutPlan);

export default router;