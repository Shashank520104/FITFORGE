import mongoose from "mongoose";

const sessionSetSchema = new mongoose.Schema(
  {
    plannedReps: { type: Number, required: true, min: 1, max: 100 },
    plannedWeight: { type: Number, min: 0, max: 500, default: null },
    restSeconds: { type: Number, required: true, min: 0, max: 3600 },
    actualReps: { type: Number, min: 1, max: 100 },
    actualWeight: { type: Number, min: 0, max: 500 },
    completedAt: { type: Date },
  },
  { _id: false },
);

const sessionExerciseSchema = new mongoose.Schema(
  {
    exerciseId: { type: String, required: true },
    exerciseName: { type: String, required: true, maxlength: 120 },
    sets: { type: [sessionSetSchema], required: true },
  },
  { _id: false },
);

const workoutSessionSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, maxlength: 128 },
    planId: { type: mongoose.Schema.Types.ObjectId, required: true },
    planName: { type: String, required: true, maxlength: 80 },
    dayNumber: { type: Number, required: true, min: 1, max: 7 },
    dayName: { type: String, required: true, maxlength: 60 },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    finishedAt: { type: Date },
    exercises: { type: [sessionExerciseSchema], required: true },
  },
  { timestamps: true },
);
workoutSessionSchema.index({ ownerId: 1, startedAt: -1 });
workoutSessionSchema.index({ ownerId: 1, startedAt: -1 });
workoutSessionSchema.index(
  { ownerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

const WorkoutSession = mongoose.model("WorkoutSession", workoutSessionSchema);

export default WorkoutSession;
