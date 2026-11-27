import { z } from "zod";
import {
  EntityIdSchema,
  GeoJsonLineStringZMSchema,
  IsoTimestampSchema,
  TrailDifficultySchema,
} from "../../contracts";

export const listTracksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListTracksQuery = z.infer<typeof listTracksQuerySchema>;

export const createTrackBodySchema = z.object({
  id: EntityIdSchema.optional(),
  trailId: EntityIdSchema.nullable().default(null),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(4000).nullable().default(null),
  difficulty: TrailDifficultySchema.nullable().default(null),
  region: z.string().trim().min(2).max(100).default("Nepal Himalayas"),
  startedAt: IsoTimestampSchema,
  endedAt: IsoTimestampSchema.nullable().default(null),
  movingTimeSeconds: z.number().int().nonnegative().default(0),
  elapsedTimeSeconds: z.number().int().nonnegative().default(0),
  totalDistanceKm: z.number().nonnegative().optional(),
  elevationGainM: z.number().int().nonnegative().optional(),
  elevationLossM: z.number().int().nonnegative().optional(),
  maxAltitudeM: z.number().int().min(-500).max(9000).nullable().optional(),
  minAltitudeM: z.number().int().min(-500).max(9000).nullable().optional(),
  geom: GeoJsonLineStringZMSchema.nullable().default(null),
  submitForCommunityReview: z.boolean().default(false),
});
export type CreateTrackBody = z.infer<typeof createTrackBodySchema>;

export const importGpxBodySchema = z.object({
  gpxXml: z.string().min(20).max(5_000_000),
  title: z.string().trim().min(1).max(160).optional(),
  notes: z.string().trim().max(4000).nullable().default(null),
  difficulty: TrailDifficultySchema.nullable().default(null),
  region: z.string().trim().min(2).max(100).default("Nepal Himalayas"),
  trailId: EntityIdSchema.nullable().default(null),
  submitForCommunityReview: z.boolean().default(false),
});
export type ImportGpxBody = z.infer<typeof importGpxBodySchema>;
