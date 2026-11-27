import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import type { AppVariables } from "../../shared/types/app.types";
import {
  createSafetyController,
  safetyController,
} from "./safety.controller";
import { safetyDocs } from "./safety.docs";

export function createSafetyRoutes(controller = safetyController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/", describeRoute(safetyDocs.list), (c) => controller.list(c));
  router.post("/", requireAuth(), describeRoute(safetyDocs.create), (c) =>
    controller.create(c),
  );
  router.patch(
    "/:id/resolve",
    requireAuth(),
    describeRoute(safetyDocs.resolve),
    (c) => controller.resolve(c),
  );

  return router;
}

export const safetyRoutes = createSafetyRoutes(createSafetyController());
