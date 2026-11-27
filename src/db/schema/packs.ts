import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BoundingBox, PackArtifact, Position2D } from "../../contracts";

export const regionalPacks = pgTable("regional_packs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  description: text("description").notNull(),
  version: text("version").notNull(),
  bounds: jsonb("bounds").$type<BoundingBox>().notNull(),
  center: jsonb("center").$type<Position2D>().notNull(),
  defaultZoom: doublePrecision("default_zoom").notNull(),
  totalSizeBytes: bigint("total_size_bytes", { mode: "number" }).notNull(),
  trailCount: integer("trail_count").default(0).notNull(),
  waypointCount: integer("waypoint_count").default(0).notNull(),
  artifacts: jsonb("artifacts").$type<PackArtifact[]>().notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
