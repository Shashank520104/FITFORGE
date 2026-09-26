import { Request, Response, NextFunction } from "express";

import {
  createUserService,
  getUserService,
  updateUserService,
  deleteUserService,
  getAllUsersService
} from "../services/user.service.js";

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await createUserService(req.body);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response
) => {
  const userId = req.params.id;

  if (typeof userId !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid User ID"
    });
    return;
  }

  const user = await getUserService(userId);

  if (!user) {
    res.status(404).json({
      success: false,
      message: "User not found"
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: user
  });
};

export const updateUser = async (
  req: Request,
  res: Response
) => {
  const userId = req.params.id;

  if (typeof userId !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid User ID"
    });
    return;
  }

  const updates = req.body;

  const user = await updateUserService(userId, updates);

  if (!user) {
    res.status(404).json({
      success: false,
      message: "User not found"
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user
  });
};

export const deleteUser = async (
  req: Request,
  res: Response
) => {
  const userId = req.params.id;

  if (typeof userId !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid User ID"
    });
    return;
  }

  const user = await deleteUserService(userId);

  if (!user) {
    res.status(404).json({
      success: false,
      message: "User not found"
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
    data: user
  });
};

export const getAllUsers = async (
  req: Request,
  res: Response
) => {
  const { sort, page, limit, ...filter } = req.query;

  const sortValue = typeof sort === "string"
    ? sort
    : "";

  const pageValue = typeof page === "string"
    ? Number(page)
    : 1;

  const limitValue = typeof limit === "string"
    ? Number(limit)
    : 10;

  const users = await getAllUsersService(
    filter,
    sortValue,
    pageValue,
    limitValue
  );

  res.status(200).json({
    success: true,
    count: users.length,
    page: pageValue,
    limit: limitValue,
    data: users
  });
};
