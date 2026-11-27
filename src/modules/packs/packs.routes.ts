import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import type { AppVariables } from "../../shared/types/app.types";
import { createPacksController, packsController } from "./packs.controller";
import { packsDocs } from "./packs.docs";

export function createPacksRoutes(controller = packsController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/", describeRoute(packsDocs.list), (c) => controller.list(c));
  router.get("/:regionId/bundle", describeRoute(packsDocs.getBundle), (c) =>
    controller.getBundle(c),
  );
  router.get("/:regionId", describeRoute(packsDocs.getById), (c) =>
    controller.getById(c),
  );
  router.put(
    "/:regionId",
    requireAuth(),
    requireRole("admin"),
    describeRoute(packsDocs.publish),
    (c) => controller.publish(c),
  );

  return router;
}

export const packsRoutes = createPacksRoutes(createPacksController());
