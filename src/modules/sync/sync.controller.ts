import type { Context } from "hono";
import {
  badRequestError,
  unauthorizedError,
  validationError,
} from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import { syncService } from "./sync.service";
import {
  syncBatchRequestSchema,
  syncPullQuerySchema,
} from "./sync.validator";

type SyncContext = Context<{ Variables: AppVariables }>;

export function createSyncController(service = syncService) {
  return {
    async batch(c: SyncContext) {
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

      const parsed = syncBatchRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const response = await service.processBatch(parsed.data, user.id);
      return sendSuccess(c, response);
    },

    async pull(c: SyncContext) {
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

      const parsed = syncPullQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const delta = await service.pullDelta(parsed.data, user.id);
      return sendSuccess(c, delta);
    },
  };
}

export const syncController = createSyncController();
