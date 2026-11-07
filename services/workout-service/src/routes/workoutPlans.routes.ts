import { Router } from "express";
import {
  createWorkoutPlan,
  deleteWorkoutPlan,
  getWorkoutPlan,
  listWorkoutPlans,
  updateWorkoutPlan,
} from "../controllers/workoutPlans.controller.js";

const router = Router();

router.route("/").get(listWorkoutPlans).post(createWorkoutPlan);
router
  .route("/:id")
  .get(getWorkoutPlan)
  .patch(updateWorkoutPlan)
  .delete(deleteWorkoutPlan);

export default router;
