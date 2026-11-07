import { Router } from "express";
import {
  abandonWorkoutSession,
  finishWorkoutSession,
  getWorkoutInsightsJob,
  getWorkoutInsights,
  listWorkoutSessions,
  logWorkoutSet,
  startWorkoutSession,
} from "../controllers/workoutSessions.controller.js";
import { WorkoutInsightsQueue } from "../jobs/insightsQueue.js";
import { CacheStore } from "../services/cache.js";

export function createWorkoutSessionRoutes(
  dependencies: {
    cache?: CacheStore;
    insightsQueue?: WorkoutInsightsQueue;
  } = {},
): Router {
  const router = Router();

  router.get("/insights/jobs/:jobId", (req, res, next) => {
    void getWorkoutInsightsJob(req, res, dependencies.insightsQueue).catch(
      next,
    );
  });
  router.get("/insights", (req, res, next) => {
    void getWorkoutInsights(req, res, dependencies.cache).catch(next);
  });
  router.route("/").get(listWorkoutSessions).post(startWorkoutSession);
  router.patch("/:id/sets", logWorkoutSet);
  router.post("/:id/finish", (req, res, next) => {
    void finishWorkoutSession(
      req,
      res,
      dependencies.insightsQueue,
      dependencies.cache,
    ).catch(next);
  });
  router.post("/:id/abandon", abandonWorkoutSession);

  return router;
}
