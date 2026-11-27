import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

export function buildErrorResponse(
  requestId: string,
  code: string,
  message: string,
  status: ContentfulStatusCode,
  details?: unknown,
): { body: ErrorBody; status: ContentfulStatusCode } {
  return {
    body: {
      success: false,
      error: details !== undefined ? { code, message, details } : { code, message },
      requestId,
    },
    status,
  };
}

export function badRequestError(
  requestId: string,
  message: string,
  details?: unknown,
) {
  return buildErrorResponse(requestId, "BAD_REQUEST", message, 400, details);
}

export function validationError(requestId: string, details: unknown) {
  return buildErrorResponse(
    requestId,
    "VALIDATION_ERROR",
    "Request validation failed",
    400,
    details,
  );
}

export function unauthorizedError(requestId: string) {
  return buildErrorResponse(
    requestId,
    "UNAUTHORIZED",
    "Authentication required",
    401,
  );
}

export function forbiddenError(
  requestId: string,
  message = "Insufficient permissions",
) {
  return buildErrorResponse(requestId, "FORBIDDEN", message, 403);
}

export function notFoundError(requestId: string, message = "Route not found") {
  return buildErrorResponse(requestId, "NOT_FOUND", message, 404);
}

export function conflictError(requestId: string, message: string) {
  return buildErrorResponse(requestId, "CONFLICT", message, 409);
}

export function serviceUnavailableError(requestId: string, message: string) {
  return buildErrorResponse(requestId, "SERVICE_UNAVAILABLE", message, 503);
}

export function internalError(requestId: string, message: string) {
  return buildErrorResponse(
    requestId,
    "INTERNAL_SERVER_ERROR",
    message,
    500,
  );
}

export function httpExceptionError(requestId: string, message: string) {
  return buildErrorResponse(requestId, "HTTP_EXCEPTION", message, 500);
}
