import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import type { AppVariables } from "../../shared/types/app.types";
import { createSyncController, syncController } from "./sync.controller";
import { syncDocs } from "./sync.docs";

export function createSyncRoutes(controller = syncController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.use("*", requireAuth());

  router.post("/batch", describeRoute(syncDocs.batch), (c) =>
    controller.batch(c),
  );
  router.get("/pull", describeRoute(syncDocs.pull), (c) => controller.pull(c));

  return router;
}

export const syncRoutes = createSyncRoutes(createSyncController());
