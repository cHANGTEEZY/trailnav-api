import { resolver } from "hono-openapi";
import { z } from "zod";
import { publicUserSchema, trekkerStatsSchema } from "./users.validator";

export const usersTags = ["Users"];

export const userProfileResponseSchema = z.object({
  success: z.literal(true),
  data: publicUserSchema,
  requestId: z.string(),
});

export const trekkerStatsResponseSchema = z.object({
  success: z.literal(true),
  data: trekkerStatsSchema,
  requestId: z.string(),
});

export const usersErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  requestId: z.string(),
});

export const usersDocs = {
  getMe: {
    tags: usersTags,
    summary: "Get current user profile",
    description: "Returns the authenticated user's profile from the database.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Current user profile",
        content: {
          "application/json": {
            schema: resolver(userProfileResponseSchema),
          },
        },
      },
      401: {
        description: "Not authenticated",
        content: {
          "application/json": { schema: resolver(usersErrorSchema) },
        },
      },
      404: {
        description: "User not found",
        content: {
          "application/json": { schema: resolver(usersErrorSchema) },
        },
      },
    },
  },
  updateMe: {
    tags: usersTags,
    summary: "Update current user profile",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Updated user profile",
        content: {
          "application/json": {
            schema: resolver(userProfileResponseSchema),
          },
        },
      },
      400: { description: "Validation failed" },
      401: { description: "Not authenticated" },
    },
  },
  getStats: {
    tags: usersTags,
    summary: "Get authenticated trekker cumulative stats",
    description:
      "Aggregates recorded distance, vertical climb, max altitude reached, hazard reports, and community trail submissions.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Trekker statistics",
        content: {
          "application/json": {
            schema: resolver(trekkerStatsResponseSchema),
          },
        },
      },
      401: { description: "Not authenticated" },
    },
  },
};
