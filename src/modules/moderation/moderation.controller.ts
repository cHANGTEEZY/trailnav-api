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
import { moderationService } from "./moderation.service";
import {
  moderationQueueQuerySchema,
  reviewTrailBodySchema,
  triageHazardBodySchema,
} from "./moderation.validator";

type ModerationContext = Context<{ Variables: AppVariables }>;

export function createModerationController(service = moderationService) {
  return {
    async getQueue(c: ModerationContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const parsed = moderationQueueQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const queue = await service.getQueue(parsed.data.limit);
      return sendSuccess(c, queue);
    },

    async reviewTrail(c: ModerationContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const user = c.get("user");
      if (!user) {
        const { body, status } = unauthorizedError(c.get("requestId"));
        return c.json(body, status);
      }

      const id = c.req.param("id")?.trim();
      if (!id) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Trail not found",
        );
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

      const parsed = reviewTrailBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const result = await service.reviewTrail(id, parsed.data, user.id);
      if (!result) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Trail not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, result);
    },

    async triageHazard(c: ModerationContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const user = c.get("user");
      if (!user) {
        const { body, status } = unauthorizedError(c.get("requestId"));
        return c.json(body, status);
      }

      const id = c.req.param("id")?.trim();
      if (!id) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Safety report not found",
        );
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

      const parsed = triageHazardBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const updated = await service.triageHazard(id, parsed.data, user.id);
      if (!updated) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Safety report not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, updated);
    },
  };
}

export const moderationController = createModerationController();
