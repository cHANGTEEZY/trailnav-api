import { z } from "zod";
import {
  BoundingBoxSchema,
  GeoJsonLineStringZMSchema,
  TrailDifficultySchema,
  TrailStatusSchema,
  WaypointDraftSchema,
  type BoundingBox,
} from "../../contracts";

export function parseBboxParam(raw: string): BoundingBox | null {
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const parsed = BoundingBoxSchema.safeParse(parts);
  if (!parsed.success) return null;
  const [west, south, east, north] = parsed.data;
  if (west > east || south > north) return null;
  return parsed.data;
}

export const listTrailsQuerySchema = z
  .object({
    region: z.string().trim().min(1).optional(),
    difficulty: TrailDifficultySchema.optional(),
    status: TrailStatusSchema.optional(),
    packRegionId: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    bbox: z
      .string()
      .trim()
      .optional()
      .transform((val, ctx) => {
        if (!val) return undefined;
        const parsed = parseBboxParam(val);
        if (!parsed) {
          ctx.addIssue({
            code: "custom",
            message:
              "bbox must be four comma-separated numbers: west,south,east,north",
          });
          return z.NEVER;
        }
        return parsed;
      }),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(200).default(25),
    simplifyTolerance: z.coerce.number().min(0).max(0.05).optional(),
    includeGeom: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((val, ctx) => {
    const hasLat = val.lat !== undefined;
    const hasLon = val.lon !== undefined;
    if (hasLat !== hasLon) {
      ctx.addIssue({
        code: "custom",
        message: "Both lat and lon must be provided together for proximity search",
      });
    }
  });

export type ListTrailsQuery = z.infer<typeof listTrailsQuerySchema>;

export const createTrailBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")
    .optional(),
  region: z.string().trim().min(2).max(100),
  description: z.string().trim().max(4000).nullable().default(null),
  difficulty: TrailDifficultySchema,
  distanceKm: z.number().nonnegative().max(1000),
  elevationGainM: z.number().int().nonnegative().max(30000),
  elevationLossM: z.number().int().nonnegative().max(30000).nullable().default(null),
  minAltitudeM: z.number().int().min(-500).max(9000).nullable().default(null),
  maxAltitudeM: z.number().int().min(-500).max(9000),
  geom: GeoJsonLineStringZMSchema,
  packRegionId: z.string().trim().min(1).nullable().default(null),
  waypoints: z.array(WaypointDraftSchema).max(100).default([]),
});

export type CreateTrailBody = z.infer<typeof createTrailBodySchema>;
