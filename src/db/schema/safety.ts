import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { geometryPoint } from "../postgis";
import { user } from "./auth";
import { trails } from "./trails";

export const hazardTypeEnum = pgEnum("hazard_type", [
  "landslide",
  "blocked_pass",
  "wildlife",
  "broken_bridge",
  "snow_ice",
]);

export const hazardSeverityEnum = pgEnum("hazard_severity", [
  "low",
  "moderate",
  "high",
  "critical",
]);

export const safetyReports = pgTable(
  "safety_reports",
  {
    id: text("id").primaryKey(),
    trailId: text("trail_id").references(() => trails.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hazardType: hazardTypeEnum("hazard_type").notNull(),
    severity: hazardSeverityEnum("severity").default("moderate").notNull(),
    description: text("description").notNull(),
    geom: geometryPoint("geom").notNull(),
    altitudeM: integer("altitude_m"),
    photoUrls: text("photo_urls")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    isResolved: boolean("is_resolved").default(false).notNull(),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_safety_reports_trail").on(table.trailId),
    index("idx_safety_reports_user").on(table.userId),
    index("idx_safety_reports_hazard_type").on(table.hazardType),
    index("idx_safety_reports_resolved").on(table.isResolved),
    index("idx_safety_reports_geom_gist").using("gist", table.geom),
  ],
);

export const safetyReportRelations = relations(safetyReports, ({ one }) => ({
  trail: one(trails, {
    fields: [safetyReports.trailId],
    references: [trails.id],
  }),
  reporter: one(user, {
    fields: [safetyReports.userId],
    references: [user.id],
  }),
}));
