import { RequestHandler, Router } from "express";
import { ProgressController } from "../controllers/progressController.js";

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createActivityRouter(controller: ProgressController): Router {
  const router = Router();
  router.post("/activities", asyncRoute(controller.logActivity));
  router.delete("/activities/:id", asyncRoute(controller.deleteActivity));
  router.post("/sleep", asyncRoute(controller.logSleep));
  router.delete("/sleep/:id", asyncRoute(controller.deleteSleep));
  router.get("/", asyncRoute(controller.getActivity));
  router.get("/summary", asyncRoute(controller.getActivitySummary));
  return router;
}

export function createProgressRouter(controller: ProgressController): Router {
  const router = Router();
  router.post("/measurements", asyncRoute(controller.saveMeasurement));
  router.get("/measurements", asyncRoute(controller.getMeasurements));
  router.post("/strength-records", asyncRoute(controller.saveStrengthRecord));
  router.get("/strength-records", asyncRoute(controller.getStrengthRecords));
  router.get("/summary", asyncRoute(controller.getProgressSummary));
  return router;
}
