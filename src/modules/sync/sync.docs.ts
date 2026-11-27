import { resolver } from "hono-openapi";
import { z } from "zod";
import { SyncBatchResponseSchema } from "../../contracts";

export const syncTags = ["Sync"];

const syncBatchEnvelopeSchema = z.object({
  success: z.literal(true),
  data: SyncBatchResponseSchema,
  requestId: z.string(),
});

export const syncDocs = {
  batch: {
    tags: syncTags,
    summary: "Flush offline SQLite outbox batch",
    description:
      "Idempotently processes recorded tracks, safety hazard reports, and photo attachment mutations queued offline. Deduplicates retries by clientEventId and reports per-item accepted, duplicate, conflict, or rejected status.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Per-item sync results",
        content: {
          "application/json": { schema: resolver(syncBatchEnvelopeSchema) },
        },
      },
      400: { description: "Validation failed" },
      401: { description: "Authentication required" },
    },
  },
  pull: {
    tags: syncTags,
    summary: "Pull incremental delta for offline SQLite cache",
    description:
      "Returns verified trails, waypoints, safety reports, and user tracks updated since the optional ISO timestamp cursor.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Delta sync payload" },
      401: { description: "Authentication required" },
    },
  },
};
