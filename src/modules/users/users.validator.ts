import { z } from "zod";
import { USER_ROLES } from "../../db/schema/auth";

export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.enum(USER_ROLES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    image: z.url().nullable().optional(),
  })
  .refine((val) => val.name !== undefined || val.image !== undefined, {
    message: "At least one field (name or image) must be provided",
  });

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const trekkerStatsSchema = z.object({
  tracksRecorded: z.number().int().nonnegative(),
  totalDistanceKm: z.number().nonnegative(),
  totalElevationGainM: z.number().int().nonnegative(),
  maxAltitudeReachedM: z.number().int().nullable(),
  hazardsReported: z.number().int().nonnegative(),
  communityTrailsSubmitted: z.number().int().nonnegative(),
});
