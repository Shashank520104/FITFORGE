import { Router } from "express";
import { getWorkouts } from "../controllers/workout.controller.js";

const router = Router();

router.get("/", getWorkouts);

export default router;