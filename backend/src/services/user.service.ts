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
  limit: number = 10,
  fields: string = ""
) => {
  const skip = (page - 1) * limit;

  let query = User.find(filter);

  if (fields) {
    query = query.select(fields);
  }

  if (sort) {
    query = query.sort(sort);
  }

  query = query
    .skip(skip)
    .limit(limit);

  const users = await query;

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

