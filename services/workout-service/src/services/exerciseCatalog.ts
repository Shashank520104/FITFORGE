import Exercise from "../models/exercise.model.js";

const starterExercises = [
  {
    name: "Barbell Back Squat",
    muscleGroups: ["quadriceps", "glutes"],
    equipment: ["barbell", "squat rack"],
    difficulty: "intermediate",
    movementType: "squat",
    description:
      "Brace your trunk, sit between your hips, and drive through the floor while keeping the bar balanced over your mid-foot.",
  },
  {
    name: "Dumbbell Bench Press",
    muscleGroups: ["chest", "triceps", "shoulders"],
    equipment: ["dumbbells", "bench"],
    difficulty: "beginner",
    movementType: "push",
    description:
      "Lower the dumbbells under control toward the sides of your chest, then press upward without losing a stable shoulder position.",
  },
  {
    name: "Bent-Over Barbell Row",
    muscleGroups: ["back", "biceps"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    movementType: "pull",
    description:
      "Hinge at the hips with a steady torso, pull the bar toward your lower ribs, and lower it with control.",
  },
  {
    name: "Romanian Deadlift",
    muscleGroups: ["hamstrings", "glutes", "back"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    movementType: "hinge",
    description:
      "Keep a soft bend in your knees and push your hips back, lowering the bar close to your legs before standing tall.",
  },
  {
    name: "Goblet Squat",
    muscleGroups: ["quadriceps", "glutes"],
    equipment: ["dumbbell"],
    difficulty: "beginner",
    movementType: "squat",
    description:
      "Hold a dumbbell close to your chest, squat to a comfortable depth with a steady torso, then return to standing.",
  },
  {
    name: "Dumbbell Shoulder Press",
    muscleGroups: ["shoulders", "triceps"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    movementType: "push",
    description:
      "Press the dumbbells overhead from shoulder height while keeping your ribs stacked over your hips.",
  },
  {
    name: "Lat Pulldown",
    muscleGroups: ["back", "biceps"],
    equipment: ["cable machine"],
    difficulty: "beginner",
    movementType: "pull",
    description:
      "Pull the bar toward your upper chest with a controlled motion, then let it return without losing posture.",
  },
  {
    name: "Farmer's Carry",
    muscleGroups: ["grip", "shoulders", "core"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    movementType: "carry",
    description:
      "Carry a pair of weights at your sides with a tall posture and steady steps over a manageable distance.",
  },
] as const;

export async function seedExerciseCatalog(): Promise<void> {
  for (const exercise of starterExercises) {
    await Exercise.updateOne(
      { name: exercise.name },
      { $setOnInsert: exercise },
      { upsert: true },
    );
  }
}
