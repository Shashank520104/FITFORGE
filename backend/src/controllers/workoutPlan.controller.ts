import { Request, Response } from "express";
import WorkoutPlan from "../models/workoutPlan.model.js";

export const createWorkoutPlan = async (
  req: Request,
  res: Response
) => {
  const workoutPlan = await WorkoutPlan.create(req.body);

  res.status(201).json({
    success: true,
    message: "Workout plan created successfully",
    data: workoutPlan
  });
};

export const getWorkoutPlan = async (
  req: Request,
  res: Response
) => {
  const workoutPlan = await WorkoutPlan.findById(req.params.id)
    .populate("days.exercises.exerciseId");

  if (!workoutPlan) {
    res.status(404).json({
      success: false,
      message: "Workout plan not found"
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: workoutPlan
  });
};