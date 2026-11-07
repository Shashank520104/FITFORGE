import mongoose from "mongoose";

const workoutSetSchema = new mongoose.Schema(
  {
    reps: { type: Number, required: true, min: 1, max: 100 },
    weight: { type: Number, min: 0, max: 500, default: null },
    restSeconds: { type: Number, required: true, min: 0, max: 3600 },
  },
  { _id: false },
);

const plannedExerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
    sets: {
      type: [workoutSetSchema],
      required: true,
    },
  },
  { _id: false },
);

const workoutDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1, max: 7 },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    exercises: { type: [plannedExerciseSchema], required: true },
  },
  { _id: false },
);

const workoutPlanSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, maxlength: 128, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    goal: {
      type: String,
      required: true,
      enum: [
        "muscle_gain",
        "fat_loss",
        "powerlifting",
        "athletic_performance",
        "general_fitness",
      ],
    },
    days: { type: [workoutDaySchema], required: true },
  },
  { timestamps: true },
);

workoutPlanSchema.index({ ownerId: 1, updatedAt: -1 });

const WorkoutPlan = mongoose.model("WorkoutPlan", workoutPlanSchema);

export default WorkoutPlan;
