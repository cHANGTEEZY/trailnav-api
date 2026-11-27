import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { geometryLineStringZM } from "../postgis";
import { user } from "./auth";
import { trailDifficultyEnum, trails } from "./trails";

export const syncStatusEnum = pgEnum("sync_status", [
  "synced",
  "local_only",
  "pending",
]);

export const recordedTracks = pgTable(
  "recorded_tracks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    trailId: text("trail_id").references(() => trails.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    difficulty: trailDifficultyEnum("difficulty"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    movingTimeSeconds: integer("moving_time_seconds").default(0).notNull(),
    elapsedTimeSeconds: integer("elapsed_time_seconds").default(0).notNull(),
    totalDistanceKm: doublePrecision("total_distance_km").default(0).notNull(),
    elevationGainM: integer("elevation_gain_m").default(0).notNull(),
    elevationLossM: integer("elevation_loss_m").default(0).notNull(),
    maxAltitudeM: integer("max_altitude_m"),
    minAltitudeM: integer("min_altitude_m"),
    geom: geometryLineStringZM("geom"),
    syncStatus: syncStatusEnum("sync_status").default("synced").notNull(),
    submittedForReview: boolean("submitted_for_review")
      .default(false)
      .notNull(),
    promotedTrailId: text("promoted_trail_id").references(() => trails.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_recorded_tracks_user").on(table.userId),
    index("idx_recorded_tracks_trail").on(table.trailId),
    index("idx_recorded_tracks_started_at").on(table.startedAt),
    index("idx_recorded_tracks_geom_gist").using("gist", table.geom),
  ],
);

export const recordedTrackRelations = relations(recordedTracks, ({ one }) => ({
  owner: one(user, {
    fields: [recordedTracks.userId],
    references: [user.id],
  }),
  trail: one(trails, {
    fields: [recordedTracks.trailId],
    references: [trails.id],
  }),
}));
