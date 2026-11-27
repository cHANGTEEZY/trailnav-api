import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const syncEntityTypeEnum = pgEnum("sync_entity_type", [
  "recorded_track",
  "safety_report",
  "waypoint_photo",
]);

export const syncOperationEnum = pgEnum("sync_operation", [
  "create",
  "update",
  "delete",
]);

export const syncEventStatusEnum = pgEnum("sync_event_status", [
  "accepted",
  "duplicate",
  "conflict",
  "rejected",
]);

export const syncEvents = pgTable(
  "sync_events",
  {
    clientEventId: text("client_event_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    entityType: syncEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    operation: syncOperationEnum("operation").notNull(),
    status: syncEventStatusEnum("status").notNull(),
    serverId: text("server_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_sync_events_user").on(table.userId),
    index("idx_sync_events_entity").on(table.entityType, table.entityId),
  ],
);
