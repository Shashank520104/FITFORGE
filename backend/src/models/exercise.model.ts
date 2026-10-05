import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    muscleGroups: {
      type: [String],
      required: true
    },

    equipment: {
      type: [String],
      required: true
    },

    difficulty: {
      type: String,
      required: true,
      enum: ["beginner", "intermediate", "advanced"]
    },

    movementType: {
      type: String,
      required: true,
      enum: [
        "push",
        "pull",
        "squat",
        "hinge",
        "carry"
      ]
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    videoUrl: {
      type: String
    },

    imageUrls: {
      type: [String]
    }
  },
  {
    timestamps: true
  }
);

const Exercise = mongoose.model("Exercise", exerciseSchema);

export default Exercise;