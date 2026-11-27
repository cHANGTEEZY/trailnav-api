import type { Context } from "hono";
import type { UserRole } from "../../db/schema/auth";
import {
  badRequestError,
  forbiddenError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import {
  SafetyReportAccessDeniedError,
  safetyService,
} from "./safety.service";
import {
  createSafetyReportBodySchema,
  listSafetyReportsQuerySchema,
  resolveSafetyReportBodySchema,
} from "./safety.validator";

type SafetyContext = Context<{ Variables: AppVariables }>;

export function createSafetyController(service = safetyService) {
  return {
    async list(c: SafetyContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const parsed = listSafetyReportsQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const { items, meta } = await service.listReports(parsed.data);
      return sendSuccess(c, items, 200, meta);
    },

    async create(c: SafetyContext) {
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

      const parsed = createSafetyReportBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const created = await service.createReport(parsed.data, user.id);
      return sendSuccess(c, created, 201);
    },

    async resolve(c: SafetyContext) {
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

      let rawBody: unknown = {};
      try {
        const text = await c.req.text();
        if (text.trim()) rawBody = JSON.parse(text);
      } catch {
        const { body, status } = badRequestError(
          c.get("requestId"),
          "Invalid JSON request body",
        );
        return c.json(body, status);
      }

      const parsed = resolveSafetyReportBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      try {
        const updated = await service.resolveReport(
          id,
          parsed.data.isResolved,
          user.id,
          (user.role ?? "trekker") as UserRole,
        );
        if (!updated) {
          const { body, status } = notFoundError(
            c.get("requestId"),
            "Safety report not found",
          );
          return c.json(body, status);
        }
        return sendSuccess(c, updated);
      } catch (err) {
        if (err instanceof SafetyReportAccessDeniedError) {
          const { body, status } = forbiddenError(
            c.get("requestId"),
            err.message,
          );
          return c.json(body, status);
        }
        throw err;
      }
    },
  };
}

export const safetyController = createSafetyController();
