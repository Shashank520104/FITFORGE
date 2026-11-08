import { RequestHandler, Router } from "express";
import { AuthController } from "../controllers/authController.js";

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/register", asyncRoute(controller.register));
  router.post("/login", asyncRoute(controller.login));
  router.post("/refresh", asyncRoute(controller.refresh));
  router.post("/logout", asyncRoute(controller.logout));
  router.get("/me", asyncRoute(controller.getMe));

  return router;
}
