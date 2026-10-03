import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },

    age: {
      type: Number,
      required: true,
      min: 13,
      max: 100
    },

    sex: {
      type: String,
      required: true,
      enum: ["male", "female", "others"]
    },

    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 300
    },

    height: {
      type: Number,
      required: true,
      min: 100,
      max: 300
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

    role: {
      type: String,
      enum: ["user", "trainer", "admin"],
      default: "user"
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ goal: 1 });
userSchema.index({ goal: 1, sex: 1 });

const User = mongoose.model("User", userSchema);

export default User;