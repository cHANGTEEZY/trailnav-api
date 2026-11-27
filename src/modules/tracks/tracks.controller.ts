import type { Context } from "hono";
import type { UserRole } from "../../db/schema/auth";
import {
  badRequestError,
  forbiddenError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "../../shared/errors/http.error";
import { GpxParseError } from "../../shared/geo/gpx";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import {
  TrackAccessDeniedError,
  TrackGeometryMissingError,
  tracksService,
} from "./tracks.service";
import {
  createTrackBodySchema,
  importGpxBodySchema,
  listTracksQuerySchema,
} from "./tracks.validator";

type TracksContext = Context<{ Variables: AppVariables }>;

export function createTracksController(service = tracksService) {
  return {
    async list(c: TracksContext) {
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

      const parsed = listTracksQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const { items, meta } = await service.listUserTracks(user.id, parsed.data);
      return sendSuccess(c, items, 200, meta);
    },

    async getById(c: TracksContext) {
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
        const { body, status } = notFoundError(c.get("requestId"), "Track not found");
        return c.json(body, status);
      }

      try {
        const track = await service.getTrackById(
          id,
          user.id,
          (user.role ?? "trekker") as UserRole,
        );
        if (!track) {
          const { body, status } = notFoundError(
            c.get("requestId"),
            "Track not found",
          );
          return c.json(body, status);
        }
        return sendSuccess(c, track);
      } catch (err) {
        if (err instanceof TrackAccessDeniedError) {
          const { body, status } = forbiddenError(c.get("requestId"), err.message);
          return c.json(body, status);
        }
        throw err;
      }
    },

    async create(c: TracksContext) {
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

      const parsed = createTrackBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const result = await service.saveTrack(parsed.data, user.id);
      return sendSuccess(c, result, 201);
    },

    async importGpx(c: TracksContext) {
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

      const parsed = importGpxBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      try {
        const result = await service.importGpx(parsed.data, user.id);
        return sendSuccess(c, result, 201);
      } catch (err) {
        if (err instanceof GpxParseError) {
          const { body, status } = badRequestError(
            c.get("requestId"),
            err.message,
          );
          return c.json(body, status);
        }
        throw err;
      }
    },

    async exportGpx(c: TracksContext) {
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
        const { body, status } = notFoundError(c.get("requestId"), "Track not found");
        return c.json(body, status);
      }

      try {
        const exported = await service.exportTrackGpx(
          id,
          user.id,
          (user.role ?? "trekker") as UserRole,
        );
        if (!exported) {
          const { body, status } = notFoundError(
            c.get("requestId"),
            "Track not found",
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
      } catch (err) {
        if (err instanceof TrackAccessDeniedError) {
          const { body, status } = forbiddenError(c.get("requestId"), err.message);
          return c.json(body, status);
        }
        if (err instanceof TrackGeometryMissingError) {
          const { body, status } = badRequestError(c.get("requestId"), err.message);
          return c.json(body, status);
        }
        throw err;
      }
    },

    async remove(c: TracksContext) {
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
        const { body, status } = notFoundError(c.get("requestId"), "Track not found");
        return c.json(body, status);
      }

      try {
        const deleted = await service.deleteTrack(
          id,
          user.id,
          (user.role ?? "trekker") as UserRole,
        );
        if (!deleted) {
          const { body, status } = notFoundError(
            c.get("requestId"),
            "Track not found",
          );
          return c.json(body, status);
        }
        return sendSuccess(c, { id, deleted: true });
      } catch (err) {
        if (err instanceof TrackAccessDeniedError) {
          const { body, status } = forbiddenError(c.get("requestId"), err.message);
          return c.json(body, status);
        }
        throw err;
      }
    },
  };
}

export const tracksController = createTracksController();
