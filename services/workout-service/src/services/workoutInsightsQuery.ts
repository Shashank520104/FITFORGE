import WorkoutSession from "../models/workoutSession.model.js";
import { buildWorkoutInsights } from "./workoutInsights.js";

export async function buildInsightsForOwner(ownerId: string) {
  const sessions = await WorkoutSession.find({
    ownerId,
    status: "completed",
  })
    .sort({ startedAt: -1 })
    .limit(100)
    .select({ startedAt: 1, exercises: 1 })
    .lean();

  const completedSessions = sessions.map((session) => ({
    _id: session._id.toString(),
    startedAt: session.startedAt,
    exercises: session.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      sets: exercise.sets.map((set) => ({
        actualReps: set.actualReps,
        actualWeight: set.actualWeight,
        completedAt: set.completedAt,
      })),
    })),
  }));

  return {
    data: buildWorkoutInsights(completedSessions),
    sessionsAnalyzed: sessions.length,
  };
}
