import { z } from "zod";
import { EntityIdSchema, IsoTimestampSchema } from "./trail";

export const SyncEntityTypeSchema = z.enum([
  "recorded_track",
  "safety_report",
  "waypoint_photo",
]);
export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>;

export const SyncOperationSchema = z.enum(["create", "update", "delete"]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncBatchItemSchema = z.object({
  clientEventId: EntityIdSchema,
  entityType: SyncEntityTypeSchema,
  entityId: EntityIdSchema,
  operation: SyncOperationSchema,
  payload: z.record(z.string(), z.unknown()),
  clientUpdatedAt: IsoTimestampSchema,
});
export type SyncBatchItem = z.infer<typeof SyncBatchItemSchema>;

export const SyncBatchRequestSchema = z.object({
  deviceId: z.string().min(1),
  items: z.array(SyncBatchItemSchema).max(100),
});
export type SyncBatchRequest = z.infer<typeof SyncBatchRequestSchema>;

export const SyncBatchItemStatusSchema = z.enum([
  "accepted",
  "duplicate",
  "conflict",
  "rejected",
]);
export type SyncBatchItemStatus = z.infer<typeof SyncBatchItemStatusSchema>;

export const SyncBatchItemResultSchema = z.object({
  clientEventId: EntityIdSchema,
  entityId: EntityIdSchema,
  status: SyncBatchItemStatusSchema,
  serverId: EntityIdSchema.nullable().default(null),
  errorCode: z.string().nullable().default(null),
  errorMessage: z.string().nullable().default(null),
});
export type SyncBatchItemResult = z.infer<typeof SyncBatchItemResultSchema>;

export const SyncBatchResponseSchema = z.object({
  syncedAt: IsoTimestampSchema,
  results: z.array(SyncBatchItemResultSchema),
});
export type SyncBatchResponse = z.infer<typeof SyncBatchResponseSchema>;

export const PresignedUploadPurposeSchema = z.enum([
  "waypoint_photo",
  "hazard_photo",
  "track_gpx",
]);
export type PresignedUploadPurpose = z.infer<
  typeof PresignedUploadPurposeSchema
>;

export const PresignedUploadRequestSchema = z.object({
  purpose: PresignedUploadPurposeSchema,
  entityId: EntityIdSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128),
  sizeBytes: z.number().int().positive(),
});
export type PresignedUploadRequest = z.infer<
  typeof PresignedUploadRequestSchema
>;

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.url(),
  publicUrl: z.url(),
  objectKey: z.string().min(1),
  expiresAt: IsoTimestampSchema,
  requiredHeaders: z.record(z.string(), z.string()).default({}),
});
export type PresignedUploadResponse = z.infer<
  typeof PresignedUploadResponseSchema
>;
