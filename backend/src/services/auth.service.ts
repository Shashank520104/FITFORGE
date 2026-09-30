import User from "../models/user.model.js";
import bcrypt from "bcrypt";

export const registerUserService = async (data: any) => {
  const existingUser = await User.findOne({
    email: data.email
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

 const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await User.create({
    name: data.name,
    email: data.email,
    password:hashedPassword,
    age: data.age,
    sex: data.sex,
    weight: data.weight,
    height: data.height,
    goal: data.goal
  });

  return user;
};

export const loginUserService = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password");
  }

const isPasswordCorrect = await bcrypt.compare(
  password,
  user.password
);

if (!isPasswordCorrect) {
  throw new Error("Invalid email or password");
}

user.password = undefined;

return user;