import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "../../middleware/require-auth";
import type { AppVariables } from "../../shared/types/app.types";
import {
  createUsersController,
  usersController,
} from "./users.controller";
import { usersDocs } from "./users.docs";

export function createUsersRoutes(controller = usersController) {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get("/me", requireAuth(), describeRoute(usersDocs.getMe), (c) =>
    controller.getMe(c),
  );
  router.patch("/me", requireAuth(), describeRoute(usersDocs.updateMe), (c) =>
    controller.updateMe(c),
  );
  router.get(
    "/me/stats",
    requireAuth(),
    describeRoute(usersDocs.getStats),
    (c) => controller.getStats(c),
  );

  return router;
}

export const usersRoutes = createUsersRoutes(createUsersController());
