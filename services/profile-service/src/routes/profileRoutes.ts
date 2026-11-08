import { RequestHandler, Router } from "express";
import { ProfileController } from "../controllers/profileController.js";

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createProfileRouter(controller: ProfileController): Router {
  const router = Router();
  router.get("/", asyncRoute(controller.getProfile));
  router.patch("/", asyncRoute(controller.patchProfile));
  return router;
}
