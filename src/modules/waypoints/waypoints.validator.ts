import { z } from "zod";
import { WaypointCategorySchema } from "../../contracts";

export const nearbyWaypointsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(10),
  category: WaypointCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type NearbyWaypointsQuery = z.infer<typeof nearbyWaypointsQuerySchema>;

export const unifiedSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).optional(),
  category: WaypointCategorySchema.optional(),
  kind: z.enum(["all", "trail", "waypoint"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type UnifiedSearchQuery = z.infer<typeof unifiedSearchQuerySchema>;
