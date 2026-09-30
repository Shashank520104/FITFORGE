import { Request, Response } from "express";
import { registerUserService,loginUserService } from "../services/auth.service.js";

export const registerUser = async (req: Request, res: Response) => {
  const user = await registerUserService(req.body);

  res.status(200).json({
    success: true,
    message: "Register controller working",
    data: user
  });
};

export const loginUser = async (req: Request, res: Response) => {
  const user = await loginUserService(
    req.body.email,
    req.body.password
  );

  res.status(200).json({
    success: true,
    message: "Login service working",
    data: user
  });
};