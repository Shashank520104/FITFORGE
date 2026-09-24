import { Request, Response } from "express";
import { getWorkoutsService } from "../services/workout.service.js";

export const getWorkouts = (req: Request, res: Response) => {
  const muscle = req.query.muscle;
  const difficulty = req.query.difficulty;

  const filters = getWorkoutsService(muscle, difficulty);

  res.json({
    success: true,
    filters: filters
  });
};