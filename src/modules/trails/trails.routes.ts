import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import type { AppVariables } from "../../shared/types/app.types";
import {
  createTrailsController,
  trailsController,
} from "./trails.controller";
import { trailsDocs } from "./trails.docs";

export function createTrailsRoutes(controller = trailsController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/", describeRoute(trailsDocs.list), (c) => controller.list(c));
  router.get("/:idOrSlug/gpx", describeRoute(trailsDocs.exportGpx), (c) =>
    controller.exportGpx(c),
  );
  router.get("/:idOrSlug", describeRoute(trailsDocs.getByIdOrSlug), (c) =>
    controller.getByIdOrSlug(c),
  );
  router.post(
    "/",
    requireAuth(),
    describeRoute(trailsDocs.create),
    (c) => controller.create(c),
  );

  return router;
}

export const trailsRoutes = createTrailsRoutes(createTrailsController());
