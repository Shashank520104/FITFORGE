import { Router } from "express";
import roleMiddleware from "../middlewares/role.middleware.js";
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


router.get(
  "/admin-test",
  authMiddleware,
  roleMiddleware(["admin"]),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome Admin"
    });
  }
);

export default router;

