import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { SEED_POON_HILL_TRAIL, SEED_POON_HILL_WAYPOINTS } from "../src/db/seed-data";
import { createTracksController } from "../src/modules/tracks/tracks.controller";
import type {
  TrackRecord,
  TracksRepository,
} from "../src/modules/tracks/tracks.repository";
import { createTracksRoutes } from "../src/modules/tracks/tracks.routes";
import { createTracksService } from "../src/modules/tracks/tracks.service";
import { createUsersController } from "../src/modules/users/users.controller";
import type { UsersRepository } from "../src/modules/users/users.repository";
import { createUsersRoutes } from "../src/modules/users/users.routes";
import { createUsersService } from "../src/modules/users/users.service";
import {
  gpxTrackToLineStringZM,
  parseGpxXml,
  serializeToGpxXml,
} from "../src/shared/geo/gpx";
import { analyzeLineStringMetrics } from "../src/shared/geo/metrics";
import type { AppVariables } from "../src/shared/types/app.types";

describe("GPX 1.1 parser, serializer, and elevation metrics", () => {
  it("round-trips Poon Hill trail with waypoints through GPX 1.1 XML", () => {
    const xml = serializeToGpxXml({
      name: SEED_POON_HILL_TRAIL.title,
      description: SEED_POON_HILL_TRAIL.description,
      line: SEED_POON_HILL_TRAIL.geom,
      waypoints: SEED_POON_HILL_WAYPOINTS,
    });

    expect(xml).toContain("<gpx");
    expect(xml).toContain("Poon Hill Sunrise Viewpoint");

    const parsed = parseGpxXml(xml);
    expect(parsed.name).toBe(SEED_POON_HILL_TRAIL.title);
    expect(parsed.points).toHaveLength(
      SEED_POON_HILL_TRAIL.geom.coordinates.length,
    );
    expect(parsed.waypoints).toHaveLength(SEED_POON_HILL_WAYPOINTS.length);

    const line = gpxTrackToLineStringZM(parsed);
    expect(line.coordinates[0][2]).toBe(1070);
    expect(line.coordinates[line.coordinates.length - 1][3]).toBeGreaterThan(
      15_000,
    );
  });

  it("applies >3m deadband elevation filtering and flags GPS altitude spikes", () => {
    const noisyMetrics = analyzeLineStringMetrics({
      type: "LineString",
      coordinates: [
        [83.7, 28.4, 2800, 0],
        [83.701, 28.401, 2802, 120], // within 3m deadband -> ignored
        [83.702, 28.402, 2799, 240], // within 3m deadband -> ignored
        [83.703, 28.403, 2810, 360], // +10m gain
        [83.704, 28.404, 2805, 480], // -5m loss
      ],
    });

    expect(noisyMetrics.elevationGainM).toBe(10);
    expect(noisyMetrics.elevationLossM).toBe(5);
    expect(noisyMetrics.elevationSpikes).toHaveLength(0);

    const spikedMetrics = analyzeLineStringMetrics({
      type: "LineString",
      coordinates: [
        [83.7, 28.4, 2800, 0],
        [83.7001, 28.4001, 3150, 15], // +350m vertical jump in 15m horizontal
      ],
    });
    expect(spikedMetrics.elevationSpikes).toHaveLength(1);
    expect(spikedMetrics.elevationSpikes[0].deltaElevationM).toBe(350);
  });
});

describe("tracks & users HTTP routes", () => {
  const store = new Map<string, TrackRecord>();

  const mockTracksRepo: TracksRepository = {
    async listByUser(userId) {
      const items = [...store.values()].filter((t) => t.userId === userId);
      return { items, total: items.length };
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async upsert(input) {
      const now = new Date().toISOString();
      const rec: TrackRecord = {
        id: input.id,
        userId: input.userId,
        trailId: input.trailId,
        title: input.title,
        notes: input.notes,
        difficulty: input.difficulty,
        startedAt: input.startedAt.toISOString(),
        endedAt: input.endedAt ? input.endedAt.toISOString() : null,
        movingTimeSeconds: input.movingTimeSeconds,
        elapsedTimeSeconds: input.elapsedTimeSeconds,
        totalDistanceKm: input.totalDistanceKm,
        elevationGainM: input.elevationGainM,
        elevationLossM: input.elevationLossM,
        maxAltitudeM: input.maxAltitudeM,
        minAltitudeM: input.minAltitudeM,
        geom: input.geom,
        syncStatus: "synced",
        submittedForReview: input.submitForCommunityReview,
        promotedTrailId: input.submitForCommunityReview
          ? `trail-community-${input.id}`
          : null,
        createdAt: now,
        updatedAt: now,
      };
      store.set(rec.id, rec);
      return rec;
    },
    async remove(id) {
      return store.delete(id);
    },
  };

  const mockUsersRepo: UsersRepository = {
    async findById(id) {
      return {
        id,
        name: "Maya Sherpa",
        email: "maya@trailnav.np",
        emailVerified: true,
        image: null,
        role: "trekker",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      };
    },
    async updateProfile(id, patch) {
      return {
        id,
        name: patch.name ?? "Maya Sherpa",
        email: "maya@trailnav.np",
        emailVerified: true,
        image: patch.image ?? null,
        role: "trekker",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date(),
      };
    },
    async getStats() {
      return {
        tracksRecorded: 3,
        totalDistanceKm: 48.6,
        totalElevationGainM: 3420,
        maxAltitudeReachedM: 5416,
        hazardsReported: 2,
        communityTrailsSubmitted: 1,
      };
    },
  };

  function makeApp(userId: string) {
    const app = new Hono<{ Variables: AppVariables }>();
    app.use("*", async (c, next) => {
      c.set("requestId", "req-tracks-test");
      c.set("user", {
        id: userId,
        name: "Maya Sherpa",
        email: "maya@trailnav.np",
        emailVerified: true,
        image: null,
        role: "trekker",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AppVariables["user"]);
      c.set("session", null);
      await next();
    });
    app.route(
      "/tracks",
      createTracksRoutes(createTracksController(createTracksService(mockTracksRepo))),
    );
    app.route(
      "/users",
      createUsersRoutes(createUsersController(createUsersService(mockUsersRepo))),
    );
    return app;
  }

  it("imports GPX, exports GPX, and enforces owner access", async () => {
    const mayaApp = makeApp("user-maya");
    const otherApp = makeApp("user-other");

    const sampleXml = serializeToGpxXml({
      name: "Poon Hill Dawn Push",
      line: {
        type: "LineString",
        coordinates: [
          [83.6992, 28.4017, 2874, 0],
          [83.6938, 28.4011, 3065, 750],
          [83.6894, 28.4004, 3210, 1500],
        ],
      },
    });

    const importRes = await mayaApp.request("/tracks/import-gpx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gpxXml: sampleXml,
        difficulty: "moderate",
        submitForCommunityReview: true,
      }),
    });

    expect(importRes.status).toBe(201);
    const imported = (await importRes.json()) as {
      data: {
        track: TrackRecord;
        analysis: { maxAltitudeM: number; elevationGainM: number };
      };
    };
    expect(imported.data.track.promotedTrailId).toContain("trail-community-");
    expect(imported.data.analysis.maxAltitudeM).toBe(3210);
    expect(imported.data.analysis.elevationGainM).toBe(336);

    const trackId = imported.data.track.id;

    // Another trekker cannot read Maya's track
    const forbiddenRes = await otherApp.request(`/tracks/${trackId}`);
    expect(forbiddenRes.status).toBe(403);

    // Owner can export GPX XML
    const exportRes = await mayaApp.request(`/tracks/${trackId}/gpx`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("Content-Type")).toContain("application/gpx+xml");
    const exportedXml = await exportRes.text();
    expect(exportedXml).toContain("Poon Hill Dawn Push");
  });

  it("updates user profile and returns cumulative trekker stats", async () => {
    const mayaApp = makeApp("user-maya");

    const patchRes = await mayaApp.request("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Maya Lama" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { data: { name: string } };
    expect(patched.data.name).toBe("Maya Lama");

    const statsRes = await mayaApp.request("/users/me/stats");
    expect(statsRes.status).toBe(200);
    const stats = (await statsRes.json()) as {
      data: { maxAltitudeReachedM: number; tracksRecorded: number };
    };
    expect(stats.data.maxAltitudeReachedM).toBe(5416);
    expect(stats.data.tracksRecorded).toBe(3);
  });
});
