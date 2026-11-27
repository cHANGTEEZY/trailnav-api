import { z } from "zod";
import {
  BoundingBoxSchema,
  PackArtifactSchema,
  Position2DSchema,
} from "../../contracts";

export const upsertPackBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  region: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2000),
  version: z.string().trim().min(1).max(40),
  bounds: BoundingBoxSchema,
  center: Position2DSchema,
  defaultZoom: z.number().min(0).max(22),
  totalSizeBytes: z.number().int().nonnegative(),
  trailCount: z.number().int().nonnegative().default(0),
  waypointCount: z.number().int().nonnegative().default(0),
  artifacts: z.array(PackArtifactSchema).min(1),
  isPublished: z.boolean().default(true),
});

export type UpsertPackBody = z.infer<typeof upsertPackBodySchema>;
