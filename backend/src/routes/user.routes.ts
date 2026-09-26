import { Router } from "express";
import {
  createUser,
  getUser,
  updateUser,
  deleteUser,
  getAllUsers
} from "../controllers/user.controller.js";

const router = Router();

router.post("/", createUser);

router.get("/:id", getUser);

router.patch("/:id", updateUser);

router.delete("/:id",deleteUser);

router.get("/",getAllUsers);

router.get("/:id",getUser);

export default router;