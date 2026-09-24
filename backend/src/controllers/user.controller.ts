import { Request, Response } from "express";
import { createUserService } from "../services/user.service.js";

export const createUser = (req: Request, res: Response) => {
  const user = createUserService(req.body);

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user
  });
};

export const getUser = (req: Request, res: Response) => {
  const userId = req.params.id;

  res.json({
    success: true,
    userId: userId
  });
};

export const updateUser = (req: Request, res: Response) => {
  const userId = req.params.id;
  const notify = req.query.notify;
  const updates = req.body;

  res.json({
    success: true,
    message: "User update received",
    data: {
      userId,
      notify,
      updates
    }
  });
};