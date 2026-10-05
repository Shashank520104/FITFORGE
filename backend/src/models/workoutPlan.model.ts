import mongoose from "mongoose";

const workoutSetSchema = new mongoose.Schema(
  {
    reps: {
      type: Number,
      required: true,
      min: 1
    },

    weight: {
      type: Number,
      min: 0,
      default: null
    },

    restSeconds: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

const plannedExerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true
    },

    sets: {
      type: [workoutSetSchema],
      required: true
    }
  },
  {
    _id: false
  }
);

const workoutDaySchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
      min: 1
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    exercises: {
      type: [plannedExerciseSchema],
      required: true
    }
  },
  {
    _id: false
  }
);

const workoutPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    goal: {
      type: String,
      required: true,
      enum: [
        "muscle_gain",
        "fat_loss",
        "powerlifting",
        "athletic_performance",
        "general_fitness"
      ]
    },

    days: {
      type: [workoutDaySchema],
      required: true
    }
  },
  {
    timestamps: true
  }
);

const WorkoutPlan = mongoose.model(
  "WorkoutPlan",
  workoutPlanSchema
);

export default WorkoutPlan;