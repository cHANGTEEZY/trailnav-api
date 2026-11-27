import { resolver } from "hono-openapi";
import { z } from "zod";
import { PackCatalogSchema, RegionalPackManifestSchema } from "../../contracts";

export const packsTags = ["Packs"];

const catalogEnvelopeSchema = z.object({
  success: z.literal(true),
  data: PackCatalogSchema,
  requestId: z.string(),
});

const packEnvelopeSchema = z.object({
  success: z.literal(true),
  data: RegionalPackManifestSchema,
  requestId: z.string(),
});

export const packsDocs = {
  list: {
    tags: packsTags,
    summary: "List published Nepal offline regional packs",
    description:
      "Returns the versioned regional pack catalog (Poon Hill, Annapurna Circuit, Khumbu/EBC, Langtang Valley, Manaslu) with .mbtiles artifact URLs and SHA-256 checksums.",
    responses: {
      200: {
        description: "Regional pack catalog",
        content: {
          "application/json": { schema: resolver(catalogEnvelopeSchema) },
        },
      },
    },
  },
  getById: {
    tags: packsTags,
    summary: "Get a regional pack manifest by region ID",
    responses: {
      200: {
        description: "Regional pack manifest",
        content: {
          "application/json": { schema: resolver(packEnvelopeSchema) },
        },
      },
      404: { description: "Regional pack not found" },
    },
  },
  getBundle: {
    tags: packsTags,
    summary: "Download regional SQLite hydration bundle",
    description:
      "Returns the pack manifest alongside all verified/approved trails, waypoints, and active hazards for that trekking zone.",
    responses: {
      200: { description: "Regional offline hydration bundle" },
      404: { description: "Regional pack not found" },
    },
  },
  publish: {
    tags: packsTags,
    summary: "Publish or update a regional pack manifest (Admin only)",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Published pack manifest" },
      401: { description: "Authentication required" },
      403: { description: "Admin role required" },
    },
  },
};
