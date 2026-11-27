import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { SafetyReport, SyncBatchResponse } from "../src/contracts";
import type { UserRole } from "../src/db/schema/auth";
import { SEED_POON_HILL_HAZARD, SEED_POON_HILL_TRAIL } from "../src/db/seed-data";
import { createSafetyController } from "../src/modules/safety/safety.controller";
import type { SafetyRepository } from "../src/modules/safety/safety.repository";
import { createSafetyRoutes } from "../src/modules/safety/safety.routes";
import { createSafetyService } from "../src/modules/safety/safety.service";
import { createSyncController } from "../src/modules/sync/sync.controller";
import type {
  SyncEventRecord,
  SyncRepository,
} from "../src/modules/sync/sync.repository";
import { createSyncRoutes } from "../src/modules/sync/sync.routes";
import { createSyncService } from "../src/modules/sync/sync.service";
import type { AppVariables } from "../src/shared/types/app.types";

describe("safety reports routes", () => {
  const reports = new Map<string, SafetyReport>([
    [
      "hz-1",
      {
        ...SEED_POON_HILL_HAZARD,
        id: "hz-1",
        userId: "user-maya",
      },
    ],
  ]);

  const mockSafetyRepo: SafetyRepository = {
    async list() {
      const items = [...reports.values()];
      return { items, total: items.length };
    },
    async findById(id) {
      return reports.get(id) ?? null;
    },
    async upsert(input) {
      const now = new Date().toISOString();
      const rec: SafetyReport = {
        id: input.id,
        trailId: input.trailId,
        userId: input.userId,
        hazardType: input.hazardType,
        severity: input.severity,
        description: input.description,
        geom: { type: "Point", coordinates: [input.longitude, input.latitude] },
        altitudeM: input.altitudeM,
        photoUrls: input.photoUrls,
        syncStatus: "synced",
        isResolved: false,
        createdAt: now,
        updatedAt: now,
      };
      reports.set(rec.id, rec);
      return rec;
    },
    async setResolved(id, isResolved) {
      const existing = reports.get(id);
      if (!existing) return null;
      const updated = { ...existing, isResolved };
      reports.set(id, updated);
      return updated;
    },
  };

  function makeSafetyApp(userId: string, role: UserRole) {
    const app = new Hono<{ Variables: AppVariables }>();
    app.use("*", async (c, next) => {
      c.set("requestId", "req-safety-test");
      c.set("user", {
        id: userId,
        name: "Test User",
        email: `${userId}@trailnav.np`,
        emailVerified: true,
        image: null,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AppVariables["user"]);
      c.set("session", null);
      await next();
    });
    app.route(
      "/safety-reports",
      createSafetyRoutes(
        createSafetyController(createSafetyService(mockSafetyRepo)),
      ),
    );
    return app;
  }

  it("creates hazard reports and restricts resolution to owner or moderator", async () => {
    const mayaApp = makeSafetyApp("user-maya", "trekker");
    const strangerApp = makeSafetyApp("user-stranger", "trekker");
    const rangerApp = makeSafetyApp("user-ranger", "moderator");

    const createRes = await mayaApp.request("/safety-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trailId: SEED_POON_HILL_TRAIL.id,
        hazardType: "landslide",
        severity: "high",
        description: "Fresh rockfall blocking bridge approach near Ulleri.",
        latitude: 28.3556,
        longitude: 83.7332,
        altitudeM: 2050,
      }),
    });
    expect(createRes.status).toBe(201);

    const deniedRes = await strangerApp.request("/safety-reports/hz-1/resolve", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResolved: true }),
    });
    expect(deniedRes.status).toBe(403);

    const modRes = await rangerApp.request("/safety-reports/hz-1/resolve", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResolved: true }),
    });
    expect(modRes.status).toBe(200);
    const body = (await modRes.json()) as { data: SafetyReport };
    expect(body.data.isResolved).toBe(true);
  });
});

describe("offline two-way sync engine", () => {
  const events = new Map<string, SyncEventRecord>();
  const tracks = new Map<string, { userId: string; updatedAt: Date }>();
  const hazards = new Map<string, { userId: string; updatedAt: Date }>();
  const photos = new Map<string, string[]>();

  tracks.set("trk-someone-else", {
    userId: "user-other",
    updatedAt: new Date("2026-10-16T00:00:00Z"),
  });

  const mockSyncRepo: SyncRepository = {
    async findEventByClientId(id) {
      return events.get(id) ?? null;
    },
    async recordEvent(evt) {
      events.set(evt.clientEventId, evt);
    },
    async findTrackOwnerAndUpdatedAt(id) {
      return tracks.get(id) ?? null;
    },
    async upsertTrack(input) {
      tracks.set(input.id, { userId: input.userId, updatedAt: new Date() });
      return { id: input.id };
    },
    async deleteTrack(id) {
      return tracks.delete(id);
    },
    async findSafetyReportOwnerAndUpdatedAt(id) {
      return hazards.get(id) ?? null;
    },
    async upsertSafetyReport(input) {
      hazards.set(input.id, { userId: input.userId, updatedAt: new Date() });
      return { id: input.id };
    },
    async deleteSafetyReport(id) {
      return hazards.delete(id);
    },
    async attachPhotoUrl(_targetType, entityId, photoUrl) {
      if (entityId === "missing-wp") return false;
      const existing = photos.get(entityId) ?? [];
      photos.set(entityId, [...existing, photoUrl]);
      return true;
    },
    async pullDelta() {
      return {
        syncedAt: "2026-10-16T12:00:00.000Z",
        trails: [SEED_POON_HILL_TRAIL],
        waypoints: [],
        safetyReports: [SEED_POON_HILL_HAZARD],
        tracks: [],
      };
    },
  };

  function makeSyncApp(userId = "user-maya") {
    const app = new Hono<{ Variables: AppVariables }>();
    app.use("*", async (c, next) => {
      c.set("requestId", "req-sync-test");
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
      "/sync",
      createSyncRoutes(createSyncController(createSyncService(mockSyncRepo))),
    );
    return app;
  }

  it("accepts mobile outbox payloads, deduplicates retries, flags ownership conflicts, and isolates bad items", async () => {
    const app = makeSyncApp();

    const batchPayload = {
      deviceId: "iphone-16-offline",
      items: [
        // Exact mobile tracking-controller.ts outbox shape
        {
          clientEventId: "evt-track-1",
          entityType: "recorded_track",
          entityId: "trk-poon-1",
          operation: "create",
          payload: {
            track: {
              id: "trk-poon-1",
              title: "Ghorepani Morning Ascent",
              startedAt: "2026-10-15T05:00:00.000Z",
              endedAt: "2026-10-15T07:30:00.000Z",
              movingTimeSeconds: 7200,
              elapsedTimeSeconds: 9000,
              totalDistanceKm: 4.2,
              elevationGainM: 340,
              elevationLossM: 20,
              geom: {
                type: "LineString",
                coordinates: [
                  [83.6992, 28.4017, 2874, 0],
                  [83.6894, 28.4004, 3210, 1500],
                ],
              },
            },
            submitForCommunityReview: true,
          },
          clientUpdatedAt: "2026-10-15T07:31:00.000Z",
        },
        // Exact mobile report-hazard.tsx outbox shape
        {
          clientEventId: "evt-hazard-1",
          entityType: "safety_report",
          entityId: "hz-offline-1",
          operation: "create",
          payload: SEED_POON_HILL_HAZARD,
          clientUpdatedAt: "2026-10-15T07:35:00.000Z",
        },
        // Ownership conflict
        {
          clientEventId: "evt-conflict-1",
          entityType: "recorded_track",
          entityId: "trk-someone-else",
          operation: "update",
          payload: {
            title: "Overwrite attempt",
            startedAt: "2026-10-15T05:00:00.000Z",
          },
          clientUpdatedAt: "2026-10-16T01:00:00.000Z",
        },
        // Malformed item isolated from valid items
        {
          clientEventId: "evt-bad-1",
          entityType: "safety_report",
          entityId: "hz-invalid",
          operation: "create",
          payload: { hazardType: "unknown_hazard" },
          clientUpdatedAt: "2026-10-15T07:40:00.000Z",
        },
      ],
    };

    const res1 = await app.request("/sync/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPayload),
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { data: SyncBatchResponse };
    expect(body1.data.results.map((r) => r.status)).toEqual([
      "accepted",
      "accepted",
      "conflict",
      "rejected",
    ]);

    // Replay same batch -> every item is cleanly deduplicated
    const res2 = await app.request("/sync/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPayload),
    });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { data: SyncBatchResponse };
    expect(body2.data.results.every((r) => r.status === "duplicate")).toBe(true);
  });

  it("returns incremental delta payload from GET /sync/pull", async () => {
    const app = makeSyncApp();
    const res = await app.request(
      "/sync/pull?since=2026-10-14T00:00:00.000Z&packRegionId=poon-hill",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { trails: unknown[]; safetyReports: unknown[] };
    };
    expect(body.data.trails).toHaveLength(1);
    expect(body.data.safetyReports).toHaveLength(1);
  });
});
