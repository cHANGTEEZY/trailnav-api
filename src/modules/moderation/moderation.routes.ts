import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import type { AppVariables } from "../../shared/types/app.types";
import {
  createModerationController,
  moderationController,
} from "./moderation.controller";
import { moderationDocs } from "./moderation.docs";

export function createModerationRoutes(controller = moderationController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.use("*", requireAuth(), requireRole("moderator", "admin"));

  router.get("/queue", describeRoute(moderationDocs.getQueue), (c) =>
    controller.getQueue(c),
  );
  router.post(
    "/trails/:id/review",
    describeRoute(moderationDocs.reviewTrail),
    (c) => controller.reviewTrail(c),
  );
  router.patch(
    "/hazards/:id",
    describeRoute(moderationDocs.triageHazard),
    (c) => controller.triageHazard(c),
  );

  return router;
}

export const moderationRoutes = createModerationRoutes(
  createModerationController(),
);
