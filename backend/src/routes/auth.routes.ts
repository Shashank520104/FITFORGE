import { Router } from "express";
import {
  registerUser,
  loginUser,
  getProfile
} from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import validationMiddleware from "../middlewares/validation.middleware.js";

const router = Router();

router.post("/register", validationMiddleware, registerUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, getProfile);

export default router;

