import { resolver } from "hono-openapi";
import { z } from "zod";
import { SafetyReportSchema } from "../../contracts";
import { PaginationMetaSchema } from "../../shared/http/response";

export const safetyTags = ["Safety"];

const safetyListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(SafetyReportSchema),
  meta: PaginationMetaSchema,
  requestId: z.string(),
});

const safetySingleResponseSchema = z.object({
  success: z.literal(true),
  data: SafetyReportSchema,
  requestId: z.string(),
});

export const safetyDocs = {
  list: {
    tags: safetyTags,
    summary: "List trail safety hazard reports",
    description:
      "Filters landslide, blocked pass, wildlife, broken bridge, and snow/ice hazards by trail, severity, active status, bounding box, or radius.",
    responses: {
      200: {
        description: "Paginated safety reports",
        content: {
          "application/json": { schema: resolver(safetyListResponseSchema) },
        },
      },
    },
  },
  create: {
    tags: safetyTags,
    summary: "Report a trail hazard",
    security: [{ cookieAuth: [] }],
    responses: {
      201: {
        description: "Hazard report created",
        content: {
          "application/json": { schema: resolver(safetySingleResponseSchema) },
        },
      },
      400: { description: "Validation failed" },
      401: { description: "Authentication required" },
    },
  },
  resolve: {
    tags: safetyTags,
    summary: "Resolve or reopen a trail hazard report",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Hazard report updated",
        content: {
          "application/json": { schema: resolver(safetySingleResponseSchema) },
        },
      },
      403: { description: "Forbidden" },
      404: { description: "Safety report not found" },
    },
  },
};
