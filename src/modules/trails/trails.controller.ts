import type { Context } from "hono";
import type { UserRole } from "../../db/schema/auth";
import {
  conflictError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import {
  TrailSlugConflictError,
  trailsService,
} from "./trails.service";
import {
  createTrailBodySchema,
  listTrailsQuerySchema,
} from "./trails.validator";

type TrailsContext = Context<{ Variables: AppVariables }>;

export function createTrailsController(service = trailsService) {
  return {
    async list(c: TrailsContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const parsed = listTrailsQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const { items, meta } = await service.listTrails(parsed.data);
      return sendSuccess(c, items, 200, meta);
    },

    async getByIdOrSlug(c: TrailsContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const idOrSlug = c.req.param("idOrSlug")?.trim();
      if (!idOrSlug) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Trail not found",
        );
        return c.json(body, status);
      }

      const trail = await service.getTrailByIdOrSlug(idOrSlug);
      if (!trail) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Trail not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, trail);
    },

    async exportGpx(c: TrailsContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const idOrSlug = c.req.param("idOrSlug")?.trim();
      if (!idOrSlug) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Trail not found",
        );
        return c.json(body, status);
      }

      const exported = await service.exportTrailGpx(idOrSlug);
      if (!exported) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Trail not found",
        );
        return c.json(body, status);
      }

      return new Response(exported.xml, {
        status: 200,
        headers: {
          "Content-Type": "application/gpx+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
        },
      });
    },

    async create(c: TrailsContext) {
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
        const { body, status } = validationError(c.get("requestId"), {
          message: "Invalid JSON request body",
        });
        return c.json(body, status);
      }

      const parsed = createTrailBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      try {
        const created = await service.createTrail(
          parsed.data,
          currentUser.id,
          (currentUser.role ?? "trekker") as UserRole,
        );
        return sendSuccess(c, created, 201);
      } catch (err) {
        if (err instanceof TrailSlugConflictError) {
          const { body, status } = conflictError(
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

export const trailsController = createTrailsController();
