import { relations, sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BoundingBox } from "../../contracts";
import { geometryLineStringZM, geometryPointZ } from "../postgis";
import { user } from "./auth";

export const trailDifficultyEnum = pgEnum("trail_difficulty", [
  "easy",
  "moderate",
  "hard",
  "alpine",
]);

export const trailStatusEnum = pgEnum("trail_status", [
  "verified",
  "community_pending",
  "community_approved",
]);

export const waypointCategoryEnum = pgEnum("waypoint_category", [
  "viewpoint",
  "teahouse",
  "water_source",
  "pass",
  "monastery",
  "hazard",
]);

export const trails = pgTable(
  "trails",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    region: text("region").notNull(),
    description: text("description"),
    difficulty: trailDifficultyEnum("difficulty").notNull(),
    distanceKm: doublePrecision("distance_km").notNull(),
    elevationGainM: integer("elevation_gain_m").notNull(),
    elevationLossM: integer("elevation_loss_m"),
    minAltitudeM: integer("min_altitude_m"),
    maxAltitudeM: integer("max_altitude_m").notNull(),
    bbox: jsonb("bbox").$type<BoundingBox | null>(),
    geom: geometryLineStringZM("geom").notNull(),
    status: trailStatusEnum("status").default("community_pending").notNull(),
    packRegionId: text("pack_region_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_trails_region").on(table.region),
    index("idx_trails_status").on(table.status),
    index("idx_trails_pack_region").on(table.packRegionId),
    index("idx_trails_geom_gist").using("gist", table.geom),
  ],
);

export const waypoints = pgTable(
  "waypoints",
  {
    id: text("id").primaryKey(),
    trailId: text("trail_id").references(() => trails.id, {
      onDelete: "cascade",
    }),
    region: text("region"),
    category: waypointCategoryEnum("category").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    geom: geometryPointZ("geom").notNull(),
    altitudeM: integer("altitude_m").notNull(),
    photoUrls: text("photo_urls")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_waypoints_trail").on(table.trailId),
    index("idx_waypoints_region").on(table.region),
    index("idx_waypoints_category").on(table.category),
    index("idx_waypoints_geom_gist").using("gist", table.geom),
  ],
);

export const trailRelations = relations(trails, ({ many, one }) => ({
  waypoints: many(waypoints),
  author: one(user, {
    fields: [trails.createdBy],
    references: [user.id],
  }),
}));

export const waypointRelations = relations(waypoints, ({ one }) => ({
  trail: one(trails, {
    fields: [waypoints.trailId],
    references: [trails.id],
  }),
}));
