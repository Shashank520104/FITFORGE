import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

export const registerUserService = async (data: any) => {
  const existingUser = await User.findOne({
    email: data.email
  });

 if (existingUser) {
  throw new AppError("Email already registered", 409);
}

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    age: data.age,
    sex: data.sex,
    weight: data.weight,
    height: data.height,
    goal: data.goal
  });

  const userObject = user.toObject();
  const { password, ...safeUser } = userObject;

  return safeUser;
};

export const loginUserService = async (
  email: string,
  password: string
) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordCorrect = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordCorrect) {
    throw new AppError("Invalid email or password", 401);
  }


  const token = jwt.sign(
  {
    userId: user._id,
    role:user.role
  },
  process.env.JWT_SECRET as string,
  {
    expiresIn: "1d"
  }
);

 const userObject = user.toObject();
const { password: storedPassword, ...safeUser } = userObject;

return {
  user: safeUser,
  token
};
};