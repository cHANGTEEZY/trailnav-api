import type { Context } from "hono";
import {
  badRequestError,
  notFoundError,
  validationError,
} from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import { packsService } from "./packs.service";
import { upsertPackBodySchema } from "./packs.validator";

type PacksContext = Context<{ Variables: AppVariables }>;

export function createPacksController(service = packsService) {
  return {
    async list(c: PacksContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const catalog = await service.getCatalog();
      return sendSuccess(c, catalog);
    },

    async getById(c: PacksContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const regionId = c.req.param("regionId")?.trim();
      if (!regionId) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Regional pack not found",
        );
        return c.json(body, status);
      }

      const pack = await service.getPackById(regionId);
      if (!pack) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Regional pack not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, pack);
    },

    async getBundle(c: PacksContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const regionId = c.req.param("regionId")?.trim();
      if (!regionId) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Regional pack not found",
        );
        return c.json(body, status);
      }

      const bundle = await service.getRegionBundle(regionId);
      if (!bundle) {
        const { body, status } = notFoundError(
          c.get("requestId"),
          "Regional pack not found",
        );
        return c.json(body, status);
      }

      return sendSuccess(c, bundle);
    },

    async publish(c: PacksContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const regionId = c.req.param("regionId")?.trim();
      if (!regionId) {
        const { body, status } = badRequestError(
          c.get("requestId"),
          "regionId parameter is required",
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

      const parsed = upsertPackBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const published = await service.publishPack(regionId, parsed.data);
      return sendSuccess(c, published);
    },
  };
}

export const packsController = createPacksController();
