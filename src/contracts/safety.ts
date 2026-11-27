import { z } from "zod";
import {
  EntityIdSchema,
  GeoJsonPointSchema,
  IsoTimestampSchema,
  LatitudeSchema,
  LongitudeSchema,
} from "./trail";
import { SyncStatusSchema } from "./track";

export const HazardTypeSchema = z.enum([
  "landslide",
  "blocked_pass",
  "wildlife",
  "broken_bridge",
  "snow_ice",
]);
export type HazardType = z.infer<typeof HazardTypeSchema>;

export const HazardSeveritySchema = z.enum([
  "low",
  "moderate",
  "high",
  "critical",
]);
export type HazardSeverity = z.infer<typeof HazardSeveritySchema>;

export const SafetyReportSchema = z.object({
  id: EntityIdSchema,
  trailId: EntityIdSchema.nullable().default(null),
  userId: EntityIdSchema,
  hazardType: HazardTypeSchema,
  severity: HazardSeveritySchema.default("moderate"),
  description: z.string().trim().min(1),
  geom: GeoJsonPointSchema,
  altitudeM: z.number().int().nullable().default(null),
  photoUrls: z.array(z.string().min(1)).default([]),
  syncStatus: SyncStatusSchema.default("synced"),
  isResolved: z.boolean().default(false),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type SafetyReport = z.infer<typeof SafetyReportSchema>;

export const CreateSafetyReportInputSchema = z.object({
  id: EntityIdSchema.optional(),
  trailId: EntityIdSchema.nullable().default(null),
  hazardType: HazardTypeSchema,
  severity: HazardSeveritySchema.default("moderate"),
  description: z.string().trim().min(1).max(2000),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  altitudeM: z.number().int().min(-500).max(9000).nullable().default(null),
  photoUrls: z.array(z.string().min(1)).max(10).default([]),
});
export type CreateSafetyReportInput = z.infer<
  typeof CreateSafetyReportInputSchema
>;
