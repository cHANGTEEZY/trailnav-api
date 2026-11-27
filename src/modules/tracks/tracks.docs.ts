import { resolver } from "hono-openapi";
import { z } from "zod";
import { RecordedTrackSchema } from "../../contracts";
import { PaginationMetaSchema } from "../../shared/http/response";

export const tracksTags = ["Tracks"];

const trackListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(RecordedTrackSchema),
  meta: PaginationMetaSchema,
  requestId: z.string(),
});

const trackSingleResponseSchema = z.object({
  success: z.literal(true),
  data: RecordedTrackSchema,
  requestId: z.string(),
});

export const tracksDocs = {
  list: {
    tags: tracksTags,
    summary: "List authenticated trekker's recorded tracks",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Paginated list of recorded tracks",
        content: {
          "application/json": { schema: resolver(trackListResponseSchema) },
        },
      },
      401: { description: "Authentication required" },
    },
  },
  getById: {
    tags: tracksTags,
    summary: "Get recorded track details",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Recorded track with LineStringZM geometry",
        content: {
          "application/json": { schema: resolver(trackSingleResponseSchema) },
        },
      },
      403: { description: "Forbidden" },
      404: { description: "Track not found" },
    },
  },
  create: {
    tags: tracksTags,
    summary: "Upload or update a recorded GPS track",
    description:
      "Saves a recorded track with deadband elevation analysis. When submitForCommunityReview is true, creates a linked community_pending trail for ranger review.",
    security: [{ cookieAuth: [] }],
    responses: {
      201: { description: "Track saved" },
      400: { description: "Validation failed" },
      401: { description: "Authentication required" },
    },
  },
  importGpx: {
    tags: tracksTags,
    summary: "Import a GPX 1.1 XML track",
    description:
      "Parses GPX 1.1 <trkpt> coordinates, computes Haversine distance and 3m deadband elevation gain/loss, flags altitude spikes, and stores a LineStringZM track.",
    security: [{ cookieAuth: [] }],
    responses: {
      201: { description: "GPX imported and analyzed" },
      400: { description: "Invalid GPX XML" },
    },
  },
  exportGpx: {
    tags: tracksTags,
    summary: "Export a recorded track as GPX 1.1 XML",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "GPX 1.1 XML document" },
      404: { description: "Track not found" },
    },
  },
  remove: {
    tags: tracksTags,
    summary: "Delete a recorded track",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Track deleted" },
      403: { description: "Forbidden" },
      404: { description: "Track not found" },
    },
  },
};
