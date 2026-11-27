import { resolver } from "hono-openapi";
import { z } from "zod";
import { OfflineSearchResultSchema, WaypointSchema } from "../../contracts";

const nearbyWaypointSchema = WaypointSchema.extend({
  distanceM: z.number().nonnegative(),
});

const nearbyResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(nearbyWaypointSchema),
  requestId: z.string(),
});

const searchResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(OfflineSearchResultSchema),
  requestId: z.string(),
});

export const waypointsDocs = {
  nearby: {
    tags: ["Waypoints"],
    summary: "Find nearest waypoints by coordinates",
    description:
      "Uses PostGIS ST_DWithin and ST_Distance on geography points to locate nearby teahouses, water sources, passes, viewpoints, and monasteries.",
    responses: {
      200: {
        description: "Nearby waypoints sorted by distance in meters",
        content: {
          "application/json": {
            schema: resolver(nearbyResponseSchema),
          },
        },
      },
      400: { description: "Invalid coordinates or radius" },
    },
  },
  search: {
    tags: ["Search"],
    summary: "Search trails and waypoints",
    description:
      "Unified search returning OfflineSearchResult items across trails and POIs (teahouses, water sources, passes, viewpoints).",
    responses: {
      200: {
        description: "Matching trails and waypoints",
        content: {
          "application/json": {
            schema: resolver(searchResponseSchema),
          },
        },
      },
      400: { description: "Missing or invalid query parameter" },
    },
  },
};
