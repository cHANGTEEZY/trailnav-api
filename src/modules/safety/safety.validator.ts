import { z } from "zod";
import {
  CreateSafetyReportInputSchema,
  HazardSeveritySchema,
  HazardTypeSchema,
} from "../../contracts";
import { parseBboxParam } from "../trails/trails.validator";

export const listSafetyReportsQuerySchema = z
  .object({
    trailId: z.string().trim().min(1).optional(),
    hazardType: HazardTypeSchema.optional(),
    severity: HazardSeveritySchema.optional(),
    activeOnly: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
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
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((val, ctx) => {
    if ((val.lat !== undefined) !== (val.lon !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Both lat and lon must be provided together",
      });
    }
  });

export type ListSafetyReportsQuery = z.infer<
  typeof listSafetyReportsQuerySchema
>;

export const createSafetyReportBodySchema = CreateSafetyReportInputSchema;
export type CreateSafetyReportBody = z.infer<
  typeof createSafetyReportBodySchema
>;

export const resolveSafetyReportBodySchema = z.object({
  isResolved: z.boolean().default(true),
});
export type ResolveSafetyReportBody = z.infer<
  typeof resolveSafetyReportBodySchema
>;
