import { z } from "zod";
import {
  EntityIdSchema,
  GeoJsonLineStringZMSchema,
  GeoJsonPointSchema,
  HazardSeveritySchema,
  HazardTypeSchema,
  IsoTimestampSchema,
  LatitudeSchema,
  LongitudeSchema,
  SyncBatchRequestSchema,
  TrailDifficultySchema,
} from "../../contracts";

export const syncBatchRequestSchema = SyncBatchRequestSchema;

export const syncPullQuerySchema = z.object({
  since: IsoTimestampSchema.optional(),
  packRegionId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;

const trackPayloadShapeSchema = z.object({
  id: EntityIdSchema.optional(),
  trailId: EntityIdSchema.nullable().optional().default(null),
  title: z.string().trim().min(1).max(160),
  notes: z.string().nullable().optional().default(null),
  difficulty: TrailDifficultySchema.nullable().optional().default(null),
  startedAt: IsoTimestampSchema,
  endedAt: IsoTimestampSchema.nullable().optional().default(null),
  movingTimeSeconds: z.number().int().nonnegative().default(0),
  elapsedTimeSeconds: z.number().int().nonnegative().default(0),
  totalDistanceKm: z.number().nonnegative().default(0),
  elevationGainM: z.number().int().nonnegative().default(0),
  elevationLossM: z.number().int().nonnegative().default(0),
  maxAltitudeM: z.number().int().min(-500).max(9000).nullable().optional().default(null),
  minAltitudeM: z.number().int().min(-500).max(9000).nullable().optional().default(null),
  geom: GeoJsonLineStringZMSchema.nullable().optional().default(null),
});

/**
 * Supports both the wrapped mobile outbox shape `{ track, submitForCommunityReview }`
 * enqueued by `tracking-controller.ts` and a flat RecordedTrack object.
 */
export const syncTrackPayloadSchema = z.union([
  z.object({
    track: trackPayloadShapeSchema,
    submitForCommunityReview: z.boolean().optional().default(false),
    region: z.string().trim().min(2).max(100).optional().default("Nepal Himalayas"),
  }),
  trackPayloadShapeSchema.extend({
    submitForCommunityReview: z.boolean().optional().default(false),
    region: z.string().trim().min(2).max(100).optional().default("Nepal Himalayas"),
  }),
]);

/**
 * Supports both GeoJSON `geom` shape (from mobile `report-hazard.tsx` SQLite outbox)
 * and flat `latitude` / `longitude` coordinates.
 */
export const syncSafetyPayloadSchema = z
  .object({
    id: EntityIdSchema.optional(),
    trailId: EntityIdSchema.nullable().optional().default(null),
    hazardType: HazardTypeSchema,
    severity: HazardSeveritySchema.optional().default("moderate"),
    description: z.string().trim().min(1).max(2000),
    geom: GeoJsonPointSchema.optional(),
    latitude: LatitudeSchema.optional(),
    longitude: LongitudeSchema.optional(),
    altitudeM: z.number().int().min(-500).max(9000).nullable().optional().default(null),
    photoUrls: z.array(z.string().min(1)).max(10).optional().default([]),
    isResolved: z.boolean().optional().default(false),
  })
  .superRefine((val, ctx) => {
    const hasGeom = val.geom !== undefined;
    const hasLatLon = val.latitude !== undefined && val.longitude !== undefined;
    if (!hasGeom && !hasLatLon) {
      ctx.addIssue({
        code: "custom",
        message: "Either geom (GeoJSON Point) or latitude/longitude must be provided",
      });
    }
  });

export const syncWaypointPhotoPayloadSchema = z.object({
  targetType: z.enum(["waypoint", "safety_report"]).default("waypoint"),
  photoUrl: z.url(),
});
