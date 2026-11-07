import { Router } from "express";
import { CacheStore } from "../services/cache.js";
import {
  getExercise,
  listExercises,
} from "../controllers/exercises.controller.js";

export function createExerciseRoutes(cache?: CacheStore): Router {
  const routes = Router();
  routes.get("/", (req, res, next) => {
    void listExercises(req, res, cache).catch(next);
  });
  routes.get("/:id", (req, res, next) => {
    void getExercise(req, res, cache).catch(next);
  });
  return routes;
}
