import { resolver } from "hono-openapi";
import { z } from "zod";
import {
  SafetyReportSchema,
  TrailSchema,
  TrailSummarySchema,
  WaypointSchema,
} from "../../contracts";
import { PaginationMetaSchema } from "../../shared/http/response";

export const trailsTags = ["Trails"];

const trailDetailSchema = TrailSchema.extend({
  waypoints: z.array(WaypointSchema),
  activeHazards: z.array(SafetyReportSchema),
});

const trailsListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.union([TrailSchema, TrailSummarySchema])),
  meta: PaginationMetaSchema,
  requestId: z.string(),
});

const trailDetailResponseSchema = z.object({
  success: z.literal(true),
  data: trailDetailSchema,
  requestId: z.string(),
});

export const trailsDocs = {
  list: {
    tags: trailsTags,
    summary: "List trails with spatial and text filters",
    description:
      "Queries Nepal trekking trails by region, difficulty, verification status, bounding box (PostGIS ST_Intersects), or proximity radius (ST_DWithin). Optionally returns simplified LineStringZM geometry.",
    responses: {
      200: {
        description: "Paginated trails list",
        content: {
          "application/json": {
            schema: resolver(trailsListResponseSchema),
          },
        },
      },
    },
  },
  getByIdOrSlug: {
    tags: trailsTags,
    summary: "Get trail details with waypoints and active hazards",
    description:
      "Returns full GeoJSON LineStringZM geometry, trail waypoints, and unresolved safety hazard reports.",
    responses: {
      200: {
        description: "Trail details",
        content: {
          "application/json": {
            schema: resolver(trailDetailResponseSchema),
          },
        },
      },
      404: { description: "Trail not found" },
    },
  },
  create: {
    tags: trailsTags,
    summary: "Submit a new community trail",
    description:
      "Creates a new trail entry. Regular trekkers submit as community_pending; moderators and admins publish directly as verified.",
    security: [{ cookieAuth: [] }],
    responses: {
      201: {
        description: "Created trail",
        content: {
          "application/json": {
            schema: resolver(trailDetailResponseSchema),
          },
        },
      },
      400: { description: "Validation failed" },
      401: { description: "Authentication required" },
      409: { description: "Trail slug already exists" },
    },
  },
};
