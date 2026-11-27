import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import type { AppVariables } from "../../shared/types/app.types";
import { createMediaController, mediaController } from "./media.controller";
import { mediaDocs } from "./media.docs";

export function createMediaRoutes(controller = mediaController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.post(
    "/presign",
    requireAuth(),
    describeRoute(mediaDocs.presign),
    (c) => controller.presign(c),
  );

  return router;
}

export const mediaRoutes = createMediaRoutes(createMediaController());
