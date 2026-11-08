import { RequestHandler, Router } from "express";
import { CoachController } from "../controllers/coachController.js";
import { FoodController } from "../controllers/foodController.js";
import { MealController } from "../controllers/mealController.js";

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createFoodRouter(controller: FoodController): Router {
  const router = Router();
  router.get("/estimate", asyncRoute(controller.checkEstimateAvailability));
  router.post("/estimate", asyncRoute(controller.estimateFood));
  router.get("/", asyncRoute(controller.listFoods));
  router.post("/", asyncRoute(controller.createFood));
  router.patch("/:id", asyncRoute(controller.updateFood));
  router.delete("/:id", asyncRoute(controller.deleteFood));
  return router;
}

export function createMealRouter(controller: MealController): Router {
  const router = Router();
  router.post("/", asyncRoute(controller.createMealLog));
  router.get("/", asyncRoute(controller.getMealLogs));
  router.delete("/:id", asyncRoute(controller.deleteMealLog));
  return router;
}

export function createCoachRouter(controller: CoachController): Router {
  const router = Router();
  router.post("/chat", asyncRoute(controller.chat));
  router.post("/stream", asyncRoute(controller.stream));
  return router;
}
