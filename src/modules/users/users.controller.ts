import type { Context } from "hono";
import {
  badRequestError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import { usersService } from "./users.service";
import { updateProfileBodySchema } from "./users.validator";

type UsersContext = Context<{ Variables: AppVariables }>;

export function createUsersController(service = usersService) {
  return {
    async getMe(c: UsersContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const currentUser = c.get("user");
      if (!currentUser) {
        const { body, status } = unauthorizedError(c.get("requestId"));
        return c.json(body, status);
      }

      const profile = await service.getProfile(currentUser.id);
      if (!profile) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "User not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, profile);
    },

    async updateMe(c: UsersContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const currentUser = c.get("user");
      if (!currentUser) {
        const { body, status } = unauthorizedError(c.get("requestId"));
        return c.json(body, status);
      }

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        const { body, status } = badRequestError(
          c.get("requestId"),
          "Invalid JSON request body",
        );
        return c.json(body, status);
      }

      const parsed = updateProfileBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const updated = await service.updateProfile(currentUser.id, parsed.data);
      if (!updated) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "User not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, updated);
    },

    async getStats(c: UsersContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const currentUser = c.get("user");
      if (!currentUser) {
        const { body, status } = unauthorizedError(c.get("requestId"));
        return c.json(body, status);
      }

      const stats = await service.getStats(currentUser.id);
      return sendSuccess(c, stats);
    },
  };
}

export const usersController = createUsersController();
