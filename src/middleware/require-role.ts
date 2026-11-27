import { createMiddleware } from "hono/factory";
import type { UserRole } from "../db/schema/auth";
import { forbiddenError, unauthorizedError } from "../shared/errors/http.error";
import type { AppVariables } from "../shared/types/app.types";

export const requireRole = (...allowedRoles: UserRole[]) =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get("user");
    const requestId = c.get("requestId");

    if (!user) {
      const { body, status } = unauthorizedError(requestId);
      return c.json(body, status);
    }

    const role = (user.role ?? "trekker") as UserRole;
    if (!allowedRoles.includes(role)) {
      const { body, status } = forbiddenError(
        requestId,
        `Requires one of the following roles: ${allowedRoles.join(", ")}`,
      );
      return c.json(body, status);
    }

    await next();
  });
