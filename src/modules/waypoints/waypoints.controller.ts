import type { Context } from "hono";
import { validationError } from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import { waypointsService } from "./waypoints.service";
import {
  nearbyWaypointsQuerySchema,
  unifiedSearchQuerySchema,
} from "./waypoints.validator";

type WaypointsContext = Context<{ Variables: AppVariables }>;

export function createWaypointsController(service = waypointsService) {
  return {
    async nearby(c: WaypointsContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const parsed = nearbyWaypointsQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const items = await service.findNearbyWaypoints(parsed.data);
      return sendSuccess(c, items);
    },

    async search(c: WaypointsContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const parsed = unifiedSearchQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      const results = await service.search(parsed.data);
      return sendSuccess(c, results);
    },
  };
}

export const waypointsController = createWaypointsController();
