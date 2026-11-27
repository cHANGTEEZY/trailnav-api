import { resolver } from "hono-openapi";
import { z } from "zod";
import { PresignedUploadResponseSchema } from "../../contracts";

export const mediaTags = ["Media"];

const presignEnvelopeSchema = z.object({
  success: z.literal(true),
  data: PresignedUploadResponseSchema,
  requestId: z.string(),
});

export const mediaDocs = {
  presign: {
    tags: mediaTags,
    summary: "Generate a Cloudflare R2 presigned PUT URL",
    description:
      "Validates MIME type and file size limits for waypoint photos, hazard photos, or GPX uploads and returns a short-lived direct R2 upload URL.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Presigned upload metadata",
        content: {
          "application/json": { schema: resolver(presignEnvelopeSchema) },
        },
      },
      400: { description: "Invalid MIME type, size limit exceeded, or bad payload" },
      401: { description: "Authentication required" },
      503: { description: "R2 storage not configured" },
    },
  },
};
