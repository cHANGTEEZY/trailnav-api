import type { Context } from "hono";
import {
  badRequestError,
  serviceUnavailableError,
  unauthorizedError,
  validationError,
} from "../../shared/errors/http.error";
import { sendSuccess } from "../../shared/http/response";
import {
  R2NotConfiguredError,
  UploadPolicyError,
} from "../../shared/storage/r2";
import type { AppVariables } from "../../shared/types/app.types";
import { ajApi } from "../../shared/utils/arcjet";
import { handleArcjetDecision } from "../../shared/utils/arcjet-deny";
import { mediaService } from "./media.service";
import { presignUploadBodySchema } from "./media.validator";

type MediaContext = Context<{ Variables: AppVariables }>;

export function createMediaController(service = mediaService) {
  return {
    async presign(c: MediaContext) {
      const decision = await ajApi.protect(c.req.raw, {
        correlationId: c.get("requestId"),
      });
      const denied = handleArcjetDecision(c, decision);
      if (denied) return denied;

      const user = c.get("user");
      if (!user) {
        const { body, status } = unauthorizedError(c.get("requestId"));
        return c.json(body, status);
      }

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        const { body, status } = badRequestError(
          c.get("requestId"),
          "Invalid JSON request body",
        );
        return c.json(body, status);
      }

      const parsed = presignUploadBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        const { body, status } = validationError(
          c.get("requestId"),
          parsed.error.flatten(),
        );
        return c.json(body, status);
      }

      try {
        const result = await service.presignUpload(user.id, parsed.data);
        return sendSuccess(c, result);
      } catch (err) {
        if (err instanceof UploadPolicyError) {
          const { body, status } = badRequestError(
            c.get("requestId"),
            err.message,
          );
          return c.json(body, status);
        }
        if (err instanceof R2NotConfiguredError) {
          const { body, status } = serviceUnavailableError(
            c.get("requestId"),
            err.message,
          );
          return c.json(body, status);
        }
        throw err;
      }
    },
  };
}

export const mediaController = createMediaController();
