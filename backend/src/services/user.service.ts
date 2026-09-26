import mongoose from "mongoose";
import User from "../models/user.model.js";

export const createUserService = async (userData: object) => {
  const user = await User.create(userData);

  return user;
};

export const getUserService = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await User.findById(userId);

  return user;
};

export const getAllUsersService = async (
  filter: object = {},
  sort: string = "",
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const users = await User.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  return users;
};

export const updateUserService = async (
  userId: string,
  updates: object
) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    updates,
    {
      new: true,
      runValidators: true
    }
  );

  return user;
};

export const deleteUserService = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await User.findByIdAndDelete(userId);

  return user;
};

