CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'trekker' NOT NULL;
--> statement-breakpoint
CREATE TYPE "public"."trail_difficulty" AS ENUM('easy', 'moderate', 'hard', 'alpine');
--> statement-breakpoint
CREATE TYPE "public"."trail_status" AS ENUM('verified', 'community_pending', 'community_approved');
--> statement-breakpoint
CREATE TYPE "public"."waypoint_category" AS ENUM('viewpoint', 'teahouse', 'water_source', 'pass', 'monastery', 'hazard');
--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('synced', 'local_only', 'pending');
--> statement-breakpoint
CREATE TYPE "public"."hazard_type" AS ENUM('landslide', 'blocked_pass', 'wildlife', 'broken_bridge', 'snow_ice');
--> statement-breakpoint
CREATE TYPE "public"."hazard_severity" AS ENUM('low', 'moderate', 'high', 'critical');
--> statement-breakpoint
CREATE TYPE "public"."sync_entity_type" AS ENUM('recorded_track', 'safety_report', 'waypoint_photo');
--> statement-breakpoint
CREATE TYPE "public"."sync_operation" AS ENUM('create', 'update', 'delete');
--> statement-breakpoint
CREATE TYPE "public"."sync_event_status" AS ENUM('accepted', 'duplicate', 'conflict', 'rejected');
--> statement-breakpoint
CREATE TABLE "trails" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"region" text NOT NULL,
	"description" text,
	"difficulty" "trail_difficulty" NOT NULL,
	"distance_km" double precision NOT NULL,
	"elevation_gain_m" integer NOT NULL,
	"elevation_loss_m" integer,
	"min_altitude_m" integer,
	"max_altitude_m" integer NOT NULL,
	"bbox" jsonb,
	"geom" geometry(LineStringZM, 4326) NOT NULL,
	"status" "trail_status" DEFAULT 'community_pending' NOT NULL,
	"pack_region_id" text,
	"created_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trails_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "waypoints" (
	"id" text PRIMARY KEY NOT NULL,
	"trail_id" text,
	"region" text,
	"category" "waypoint_category" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"geom" geometry(PointZ, 4326) NOT NULL,
	"altitude_m" integer NOT NULL,
	"photo_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recorded_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"trail_id" text,
	"title" text NOT NULL,
	"notes" text,
	"difficulty" "trail_difficulty",
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"moving_time_seconds" integer DEFAULT 0 NOT NULL,
	"elapsed_time_seconds" integer DEFAULT 0 NOT NULL,
	"total_distance_km" double precision DEFAULT 0 NOT NULL,
	"elevation_gain_m" integer DEFAULT 0 NOT NULL,
	"elevation_loss_m" integer DEFAULT 0 NOT NULL,
	"max_altitude_m" integer,
	"min_altitude_m" integer,
	"geom" geometry(LineStringZM, 4326),
	"sync_status" "sync_status" DEFAULT 'synced' NOT NULL,
	"submitted_for_review" boolean DEFAULT false NOT NULL,
	"promoted_trail_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"trail_id" text,
	"user_id" text NOT NULL,
	"hazard_type" "hazard_type" NOT NULL,
	"severity" "hazard_severity" DEFAULT 'moderate' NOT NULL,
	"description" text NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"altitude_m" integer,
	"photo_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regional_packs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"description" text NOT NULL,
	"version" text NOT NULL,
	"bounds" jsonb NOT NULL,
	"center" jsonb NOT NULL,
	"default_zoom" double precision NOT NULL,
	"total_size_bytes" bigint NOT NULL,
	"trail_count" integer DEFAULT 0 NOT NULL,
	"waypoint_count" integer DEFAULT 0 NOT NULL,
	"artifacts" jsonb NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"client_event_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"operation" "sync_operation" NOT NULL,
	"status" "sync_event_status" NOT NULL,
	"server_id" text,
	"error_code" text,
	"error_message" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trails" ADD CONSTRAINT "trails_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trails" ADD CONSTRAINT "trails_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waypoints" ADD CONSTRAINT "waypoints_trail_id_trails_id_fk" FOREIGN KEY ("trail_id") REFERENCES "public"."trails"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recorded_tracks" ADD CONSTRAINT "recorded_tracks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recorded_tracks" ADD CONSTRAINT "recorded_tracks_trail_id_trails_id_fk" FOREIGN KEY ("trail_id") REFERENCES "public"."trails"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recorded_tracks" ADD CONSTRAINT "recorded_tracks_promoted_trail_id_trails_id_fk" FOREIGN KEY ("promoted_trail_id") REFERENCES "public"."trails"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_trail_id_trails_id_fk" FOREIGN KEY ("trail_id") REFERENCES "public"."trails"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_trails_region" ON "trails" USING btree ("region");
--> statement-breakpoint
CREATE INDEX "idx_trails_status" ON "trails" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_trails_pack_region" ON "trails" USING btree ("pack_region_id");
--> statement-breakpoint
CREATE INDEX "idx_trails_geom_gist" ON "trails" USING gist ("geom");
--> statement-breakpoint
CREATE INDEX "idx_waypoints_trail" ON "waypoints" USING btree ("trail_id");
--> statement-breakpoint
CREATE INDEX "idx_waypoints_region" ON "waypoints" USING btree ("region");
--> statement-breakpoint
CREATE INDEX "idx_waypoints_category" ON "waypoints" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "idx_waypoints_geom_gist" ON "waypoints" USING gist ("geom");
--> statement-breakpoint
CREATE INDEX "idx_recorded_tracks_user" ON "recorded_tracks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_recorded_tracks_trail" ON "recorded_tracks" USING btree ("trail_id");
--> statement-breakpoint
CREATE INDEX "idx_recorded_tracks_started_at" ON "recorded_tracks" USING btree ("started_at");
--> statement-breakpoint
CREATE INDEX "idx_recorded_tracks_geom_gist" ON "recorded_tracks" USING gist ("geom");
--> statement-breakpoint
CREATE INDEX "idx_safety_reports_trail" ON "safety_reports" USING btree ("trail_id");
--> statement-breakpoint
CREATE INDEX "idx_safety_reports_user" ON "safety_reports" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_safety_reports_hazard_type" ON "safety_reports" USING btree ("hazard_type");
--> statement-breakpoint
CREATE INDEX "idx_safety_reports_resolved" ON "safety_reports" USING btree ("is_resolved");
--> statement-breakpoint
CREATE INDEX "idx_safety_reports_geom_gist" ON "safety_reports" USING gist ("geom");
--> statement-breakpoint
CREATE INDEX "idx_sync_events_user" ON "sync_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_sync_events_entity" ON "sync_events" USING btree ("entity_type","entity_id");
