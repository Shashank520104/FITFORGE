import { RequestHandler, Router } from "express";
import { PersonalizationController } from "../controllers/personalizationController.js";

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createPersonalizationRouter(
  controller: PersonalizationController,
): Router {
  const router = Router();

  // Profile endpoints
  router.get("/profile", asyncRoute(controller.getProfile));
  router.put("/profile", asyncRoute(controller.updateProfile));

  // Report endpoints
  router.get("/reports", asyncRoute(controller.listReports));
  router.post("/reports", asyncRoute(controller.uploadReport));
  router.post(
    "/reports/:reportId/summary",
    asyncRoute(controller.summarizeReport),
  );
  router.delete("/reports/:reportId", asyncRoute(controller.deleteReport));

  // Plan endpoints
  router.get("/plan", asyncRoute(controller.getPlan));
  router.post("/plan/generate", asyncRoute(controller.generatePlan));

  return router;
}
