import { z } from "zod";
import {
  GeoJsonLineStringZMSchema,
  HazardSeveritySchema,
  TrailDifficultySchema,
} from "../../contracts";

export const moderationQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;

export const reviewTrailBodySchema = z.object({
  decision: z.enum(["approve_verified", "approve_community", "reject"]),
  reviewNotes: z.string().trim().max(2000).nullable().optional().default(null),
  title: z.string().trim().min(3).max(160).optional(),
  region: z.string().trim().min(2).max(100).optional(),
  difficulty: TrailDifficultySchema.optional(),
  packRegionId: z.string().trim().min(1).nullable().optional(),
  geom: GeoJsonLineStringZMSchema.optional(),
});
export type ReviewTrailBody = z.infer<typeof reviewTrailBodySchema>;

export const triageHazardBodySchema = z
  .object({
    severity: HazardSeveritySchema.optional(),
    isResolved: z.boolean().optional(),
    description: z.string().trim().min(1).max(2000).optional(),
  })
  .refine(
    (val) =>
      val.severity !== undefined ||
      val.isResolved !== undefined ||
      val.description !== undefined,
    { message: "At least one field must be provided for hazard triage" },
  );
export type TriageHazardBody = z.infer<typeof triageHazardBodySchema>;
