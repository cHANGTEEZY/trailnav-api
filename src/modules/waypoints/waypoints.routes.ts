import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import type { AppVariables } from "../../shared/types/app.types";
import {
  createWaypointsController,
  waypointsController,
} from "./waypoints.controller";
import { waypointsDocs } from "./waypoints.docs";

export function createWaypointsRoutes(controller = waypointsController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/nearby", describeRoute(waypointsDocs.nearby), (c) =>
    controller.nearby(c),
  );

  return router;
}

export function createSearchRoutes(controller = waypointsController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/", describeRoute(waypointsDocs.search), (c) =>
    controller.search(c),
  );

  return router;
}

export const waypointsRoutes = createWaypointsRoutes(
  createWaypointsController(),
);
export const searchRoutes = createSearchRoutes(createWaypointsController());
