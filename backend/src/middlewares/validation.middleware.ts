import { Request, Response, NextFunction } from "express";

const validationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, email, password, age, sex, weight, height, goal } = req.body;

  if (!name || !email || !password || !age || !sex || !weight || !height || !goal) {
    res.status(400).json({
      success: false,
      message: "All fields are required"
    });
    return;
  }
  if (age < 13 || age > 100) {
  res.status(400).json({
    success: false,
    message: "Age must be between 13 and 100"
  });
  return;
}
if (weight < 20 || weight > 300) {
  res.status(400).json({
    success: false,
    message: "Weight must be between 20 and 300 kg"
  });
  return;
}
if (height < 100 || height > 250) {
  res.status(400).json({
    success: false,
    message: "Height must be between 100 and 250 cm"
  });
  return;
}
if (!["male", "female", "other"].includes(sex)) {
  res.status(400).json({
    success: false,
    message: "Invalid sex value"
  });
  return;
}
if (
  ![
    "muscle_gain",
    "fat_loss",
    "Bodybuilding",
    "powerlifting",
    "athletic_performance",
    "general_fitness"
  ].includes(goal)
) {
  res.status(400).json({
    success: false,
    message: "Invalid goal value"
  });
  return;
}
if (!email.includes("@")) {
  res.status(400).json({
    success: false,
    message: "Please enter a valid email"
  });
  return;
}
if (password.length < 6) {
  res.status(400).json({
    success: false,
    message: "Password must be at least 6 characters"
  });
  return;
}
next();
};

export default validationMiddleware;