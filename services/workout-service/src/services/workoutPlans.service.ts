import mongoose from "mongoose";
import Exercise from "../models/exercise.model.js";
import WorkoutPlan from "../models/workoutPlan.model.js";

export type WorkoutPlanInput = {
  name: string;
  goal:
    | "muscle_gain"
    | "fat_loss"
    | "powerlifting"
    | "athletic_performance"
    | "general_fitness";
  days: Array<{
    day: number;
    name: string;
    exercises: Array<{
      exerciseId: string;
      sets: Array<{
        reps: number;
        weight?: number | null;
        restSeconds: number;
      }>;
    }>;
  }>;
};

function exerciseIdsFrom(
  days: WorkoutPlanInput["days"],
): mongoose.Types.ObjectId[] {
  return [
    ...new Set(
      days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.exerciseId),
      ),
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));
}

export async function exercisesExist(
  days: WorkoutPlanInput["days"],
): Promise<boolean> {
  const ids = exerciseIdsFrom(days);
  if (ids.length === 0) {
    return true;
  }

  return (await Exercise.countDocuments({ _id: { $in: ids } })) === ids.length;
}

export async function createWorkoutPlan(
  ownerId: string,
  input: WorkoutPlanInput,
) {
  return WorkoutPlan.create({ ...input, ownerId });
}

export async function listWorkoutPlans(
  ownerId: string,
  page: number,
  limit: number,
) {
  const filter = { ownerId };
  const [data, total] = await Promise.all([
    WorkoutPlan.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WorkoutPlan.countDocuments(filter),
  ]);

  return { data, total };
}

export async function getWorkoutPlan(ownerId: string, id: string) {
  return WorkoutPlan.findOne({ _id: id, ownerId })
    .populate<{
      days: Array<{
        day: number;
        name: string;
        exercises: Array<{
          exerciseId: { _id: mongoose.Types.ObjectId; name: string };
          sets: Array<{
            reps: number;
            weight?: number | null;
            restSeconds: number;
          }>;
        }>;
      }>;
    }>("days.exercises.exerciseId")
    .lean();
}

export async function updateWorkoutPlan(
  ownerId: string,
  id: string,
  updates: Partial<WorkoutPlanInput>,
) {
  return WorkoutPlan.findOneAndUpdate(
    { _id: id, ownerId },
    { $set: updates },
    { returnDocument: "after", runValidators: true },
  ).lean();
}

export async function deleteWorkoutPlan(ownerId: string, id: string) {
  return WorkoutPlan.findOneAndDelete({ _id: id, ownerId }).lean();
}

export function isValidPlanId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}
