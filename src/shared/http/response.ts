import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { AppVariables } from "../types/app.types";

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export function sendSuccess<T>(
  c: Context<{ Variables: AppVariables }>,
  data: T,
  status: ContentfulStatusCode = 200,
  meta?: PaginationMeta,
) {
  const payload =
    meta !== undefined
      ? {
          success: true as const,
          data,
          meta,
          requestId: c.get("requestId"),
        }
      : {
          success: true as const,
          data,
          requestId: c.get("requestId"),
        };

  return c.json(payload, status);
}
