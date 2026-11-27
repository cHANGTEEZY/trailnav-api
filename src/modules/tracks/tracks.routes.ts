import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import type { AppVariables } from "../../shared/types/app.types";
import {
  createTracksController,
  tracksController,
} from "./tracks.controller";
import { tracksDocs } from "./tracks.docs";

export function createTracksRoutes(controller = tracksController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.use("*", requireAuth());

  router.get("/", describeRoute(tracksDocs.list), (c) => controller.list(c));
  router.post("/", describeRoute(tracksDocs.create), (c) =>
    controller.create(c),
  );
  router.post("/import-gpx", describeRoute(tracksDocs.importGpx), (c) =>
    controller.importGpx(c),
  );
  router.get("/:id/gpx", describeRoute(tracksDocs.exportGpx), (c) =>
    controller.exportGpx(c),
  );
  router.get("/:id", describeRoute(tracksDocs.getById), (c) =>
    controller.getById(c),
  );
  router.delete("/:id", describeRoute(tracksDocs.remove), (c) =>
    controller.remove(c),
  );

  return router;
}

export const tracksRoutes = createTracksRoutes(createTracksController());
