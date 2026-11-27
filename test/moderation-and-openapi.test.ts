import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { app } from "../src/app";
import type { SafetyReport, Trail } from "../src/contracts";
import type { UserRole } from "../src/db/schema/auth";
import { SEED_POON_HILL_HAZARD, SEED_POON_HILL_TRAIL } from "../src/db/seed-data";
import { createModerationController } from "../src/modules/moderation/moderation.controller";
import type { ModerationRepository } from "../src/modules/moderation/moderation.repository";
import { createModerationRoutes } from "../src/modules/moderation/moderation.routes";
import { createModerationService } from "../src/modules/moderation/moderation.service";
import type { AppVariables } from "../src/shared/types/app.types";

describe("admin & ranger moderation routes", () => {
  const spikedTrail: Trail = {
    ...SEED_POON_HILL_TRAIL,
    id: "trail-community-mardi",
    slug: "mardi-himal-community",
    title: "Mardi Himal Ridge Submission",
    status: "community_pending",
    geom: {
      type: "LineString",
      coordinates: [
        [83.92, 28.42, 3050, 0],
        [83.9201, 28.4201, 3420, 15], // GPS altitude spike (+370m in 15m)
        [83.925, 28.43, 3550, 1200],
      ],
    },
  };

  const pendingStore = new Map<string, Trail>([[spikedTrail.id, spikedTrail]]);
  const hazardStore = new Map<string, SafetyReport>([
    [SEED_POON_HILL_HAZARD.id, { ...SEED_POON_HILL_HAZARD }],
  ]);

  const mockModRepo: ModerationRepository = {
    async listPendingTrails() {
      return [...pendingStore.values()].filter(
        (t) => t.status === "community_pending",
      );
    },
    async listUnresolvedHazards() {
      return [...hazardStore.values()].filter((h) => !h.isResolved);
    },
    async findTrailById(id) {
      return pendingStore.get(id) ?? null;
    },
    async applyTrailReview(id, patch) {
      const existing = pendingStore.get(id);
      if (!existing) return null;
      const updated: Trail = {
        ...existing,
        status: patch.status,
        title: patch.title ?? existing.title,
        region: patch.region ?? existing.region,
        difficulty: patch.difficulty ?? existing.difficulty,
        packRegionId:
          patch.packRegionId !== undefined
            ? patch.packRegionId
            : existing.packRegionId,
        geom: patch.geom ?? existing.geom,
        bbox: patch.bbox ?? existing.bbox,
        distanceKm: patch.distanceKm ?? existing.distanceKm,
        elevationGainM: patch.elevationGainM ?? existing.elevationGainM,
        elevationLossM: patch.elevationLossM ?? existing.elevationLossM,
        minAltitudeM: patch.minAltitudeM ?? existing.minAltitudeM,
        maxAltitudeM: patch.maxAltitudeM ?? existing.maxAltitudeM,
        updatedAt: patch.reviewedAt.toISOString(),
      };
      pendingStore.set(id, updated);
      return updated;
    },
    async deleteTrail(id) {
      return pendingStore.delete(id);
    },
    async triageHazard(id, patch) {
      const existing = hazardStore.get(id);
      if (!existing) return null;
      const updated: SafetyReport = {
        ...existing,
        severity: patch.severity ?? existing.severity,
        isResolved: patch.isResolved ?? existing.isResolved,
        description: patch.description ?? existing.description,
        updatedAt: new Date().toISOString(),
      };
      hazardStore.set(id, updated);
      return updated;
    },
  };

  function makeModApp(role: UserRole | null) {
    const modApp = new Hono<{ Variables: AppVariables }>();
    modApp.use("*", async (c, next) => {
      c.set("requestId", "req-mod-test");
      c.set(
        "user",
        role
          ? ({
              id: "user-ranger-1",
              name: "Pasang Ranger",
              email: "pasang@trailnav.np",
              emailVerified: true,
              image: null,
              role,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as AppVariables["user"])
          : null,
      );
      c.set("session", null);
      await next();
    });
    modApp.route(
      "/admin/moderation",
      createModerationRoutes(
        createModerationController(createModerationService(mockModRepo)),
      ),
    );
    return modApp;
  }

  it("blocks unauthenticated and regular trekker requests", async () => {
    expect(
      (await makeModApp(null).request("/admin/moderation/queue")).status,
    ).toBe(401);
    expect(
      (await makeModApp("trekker").request("/admin/moderation/queue")).status,
    ).toBe(403);
  });

  it("returns queue with elevation spike diagnostics, approves with corrected geometry, and triages hazards", async () => {
    const modApp = makeModApp("moderator");

    const queueRes = await modApp.request("/admin/moderation/queue");
    expect(queueRes.status).toBe(200);
    const queueBody = (await queueRes.json()) as {
      data: {
        summary: {
          pendingTrailCount: number;
          flaggedSpikeTrailCount: number;
          unresolvedHazardCount: number;
        };
      };
    };
    expect(queueBody.data.summary.pendingTrailCount).toBe(1);
    expect(queueBody.data.summary.flaggedSpikeTrailCount).toBe(1);
    expect(queueBody.data.summary.unresolvedHazardCount).toBe(1);

    // Approve with cleaned geometry -> recomputes elevation metrics
    const reviewRes = await modApp.request(
      `/admin/moderation/trails/${spikedTrail.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "approve_verified",
          reviewNotes: "Removed barometric spike at point 1 after DEM check.",
          geom: {
            type: "LineString",
            coordinates: [
              [83.92, 28.42, 3050, 0],
              [83.9225, 28.425, 3300, 600],
              [83.925, 28.43, 3550, 1200],
            ],
          },
        }),
      },
    );
    expect(reviewRes.status).toBe(200);
    const reviewBody = (await reviewRes.json()) as {
      data: { trail: Trail };
    };
    expect(reviewBody.data.trail.status).toBe("verified");
    expect(reviewBody.data.trail.elevationGainM).toBe(500);

    // Triage hazard severity & mark resolved
    const triageRes = await modApp.request(
      `/admin/moderation/hazards/${SEED_POON_HILL_HAZARD.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity: "high", isResolved: true }),
      },
    );
    expect(triageRes.status).toBe(200);
    const triageBody = (await triageRes.json()) as { data: SafetyReport };
    expect(triageBody.data.severity).toBe("high");
    expect(triageBody.data.isResolved).toBe(true);
  });
});

describe("OpenAPI documentation endpoint", () => {
  it("exposes complete OpenAPI 3 specification with all domain tags", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      info: { title: string };
      tags: Array<{ name: string }>;
      paths: Record<string, unknown>;
    };

    expect(spec.info.title).toBe("TrailNav Nepal API");
    const tagNames = spec.tags.map((t) => t.name);
    for (const expected of [
      "Health",
      "Auth",
      "Users",
      "Trails",
      "Tracks",
      "Waypoints",
      "Search",
      "Safety",
      "Sync",
      "Packs",
      "Media",
      "Moderation",
    ]) {
      expect(tagNames).toContain(expected);
    }

    expect(spec.paths["/api/v1/trails"]).toBeDefined();
    expect(spec.paths["/api/v1/sync/batch"]).toBeDefined();
    expect(spec.paths["/api/v1/packs"]).toBeDefined();
    expect(spec.paths["/api/v1/media/presign"]).toBeDefined();
    expect(spec.paths["/api/v1/admin/moderation/queue"]).toBeDefined();
  });
});
