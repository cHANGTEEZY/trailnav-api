import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { PresignedUploadResponse, RegionalPackManifest } from "../src/contracts";
import type { UserRole } from "../src/db/schema/auth";
import {
  buildSeedRegionalPacks,
  SEED_POON_HILL_HAZARD,
  SEED_POON_HILL_TRAIL,
  SEED_POON_HILL_WAYPOINTS,
} from "../src/db/seed-data";
import { createMediaController } from "../src/modules/media/media.controller";
import { createMediaRoutes } from "../src/modules/media/media.routes";
import { createMediaService } from "../src/modules/media/media.service";
import { createPacksController } from "../src/modules/packs/packs.controller";
import type { PacksRepository } from "../src/modules/packs/packs.repository";
import { createPacksRoutes } from "../src/modules/packs/packs.routes";
import { createPacksService } from "../src/modules/packs/packs.service";
import {
  buildObjectKey,
  R2NotConfiguredError,
  type PresignedUrlSigner,
} from "../src/shared/storage/r2";
import type { AppVariables } from "../src/shared/types/app.types";

describe("regional packs routes", () => {
  const seedPacks = new Map<string, RegionalPackManifest>(
    buildSeedRegionalPacks().map((p) => [p.id, p]),
  );

  const mockPacksRepo: PacksRepository = {
    async listPublished() {
      return [...seedPacks.values()];
    },
    async findById(regionId) {
      return seedPacks.get(regionId) ?? null;
    },
    async getBundle(regionId) {
      const pack = seedPacks.get(regionId);
      if (!pack) return null;
      return {
        pack,
        generatedAt: "2026-10-16T00:00:00.000Z",
        trails: regionId === "poon-hill" ? [SEED_POON_HILL_TRAIL] : [],
        waypoints: regionId === "poon-hill" ? SEED_POON_HILL_WAYPOINTS : [],
        safetyReports: regionId === "poon-hill" ? [SEED_POON_HILL_HAZARD] : [],
      };
    },
    async upsert(regionId, input) {
      const saved: RegionalPackManifest = {
        id: regionId,
        name: input.name,
        region: input.region,
        description: input.description,
        version: input.version,
        bounds: input.bounds,
        center: input.center,
        defaultZoom: input.defaultZoom,
        totalSizeBytes: input.totalSizeBytes,
        trailCount: input.trailCount,
        waypointCount: input.waypointCount,
        artifacts: input.artifacts,
        updatedAt: new Date().toISOString(),
      };
      seedPacks.set(regionId, saved);
      return saved;
    },
  };

  function makePacksApp(role: UserRole | null) {
    const app = new Hono<{ Variables: AppVariables }>();
    app.use("*", async (c, next) => {
      c.set("requestId", "req-packs-test");
      c.set(
        "user",
        role
          ? ({
              id: "user-1",
              name: "Admin Ranger",
              email: "ranger@trailnav.np",
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
    app.route(
      "/packs",
      createPacksRoutes(createPacksController(createPacksService(mockPacksRepo))),
    );
    return app;
  }

  it("returns the 5 Nepal regional packs and Poon Hill hydration bundle", async () => {
    const app = makePacksApp(null);

    const catalogRes = await app.request("/packs");
    expect(catalogRes.status).toBe(200);
    const catalog = (await catalogRes.json()) as {
      data: { packs: RegionalPackManifest[] };
    };
    expect(catalog.data.packs).toHaveLength(5);

    const bundleRes = await app.request("/packs/poon-hill/bundle");
    expect(bundleRes.status).toBe(200);
    const bundle = (await bundleRes.json()) as {
      data: {
        pack: RegionalPackManifest;
        trails: unknown[];
        waypoints: unknown[];
        safetyReports: unknown[];
      };
    };
    expect(bundle.data.trails).toHaveLength(1);
    expect(bundle.data.waypoints).toHaveLength(8);
    expect(bundle.data.safetyReports).toHaveLength(1);

    const missingRes = await app.request("/packs/unknown-valley");
    expect(missingRes.status).toBe(404);
  });

  it("restricts PUT /packs/:regionId to admin role", async () => {
    const poonHill = buildSeedRegionalPacks()[0];

    const trekkerRes = await makePacksApp("trekker").request("/packs/poon-hill", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...poonHill, version: "2026.11.0" }),
    });
    expect(trekkerRes.status).toBe(403);

    const adminRes = await makePacksApp("admin").request("/packs/poon-hill", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...poonHill, version: "2026.11.0" }),
    });
    expect(adminRes.status).toBe(200);
    const body = (await adminRes.json()) as { data: RegionalPackManifest };
    expect(body.data.version).toBe("2026.11.0");
  });
});

describe("Cloudflare R2 media presign routes", () => {
  function makeMediaApp(signer: PresignedUrlSigner) {
    const app = new Hono<{ Variables: AppVariables }>();
    app.use("*", async (c, next) => {
      c.set("requestId", "req-media-test");
      c.set("user", {
        id: "user-maya",
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
      "/media",
      createMediaRoutes(createMediaController(createMediaService(signer))),
    );
    return app;
  }

  it("scopes object keys safely and signs valid photo uploads", async () => {
    const key = buildObjectKey("user-maya", {
      purpose: "hazard_photo",
      entityId: "hz/../../etc",
      fileName: "Landslide Photo (1).JPEG",
    });
    expect(key).toStartWith("uploads/hazard_photo/user-maya/");
    expect(key).not.toContain("..");

    const mockSigner: PresignedUrlSigner = {
      async presignPut({ objectKey }) {
        return {
          uploadUrl: `https://r2.example.com/signed/${objectKey}?sig=abc`,
          publicUrl: `https://media.trailnav.np/${objectKey}`,
        };
      },
    };

    const app = makeMediaApp(mockSigner);
    const res = await app.request("/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "hazard_photo",
        entityId: "hz-123",
        fileName: "bridge-washout.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_250_000,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: PresignedUploadResponse };
    expect(body.data.uploadUrl).toContain("https://r2.example.com/signed/");
    expect(body.data.requiredHeaders["Content-Type"]).toBe("image/jpeg");
  });

  it("rejects disallowed MIME types, oversized uploads, and unconfigured R2", async () => {
    const unconfiguredSigner: PresignedUrlSigner = {
      async presignPut() {
        throw new R2NotConfiguredError();
      },
    };
    const app = makeMediaApp(unconfiguredSigner);

    const badMime = await app.request("/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "waypoint_photo",
        entityId: "wp-1",
        fileName: "payload.sh",
        contentType: "application/x-sh",
        sizeBytes: 256,
      }),
    });
    expect(badMime.status).toBe(400);

    const tooLarge = await app.request("/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "waypoint_photo",
        entityId: "wp-1",
        fileName: "huge.jpg",
        contentType: "image/jpeg",
        sizeBytes: 25 * 1024 * 1024,
      }),
    });
    expect(tooLarge.status).toBe(400);

    const noR2 = await app.request("/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "track_gpx",
        entityId: "trk-1",
        fileName: "annapurna.gpx",
        contentType: "application/gpx+xml",
        sizeBytes: 40_000,
      }),
    });
    expect(noR2.status).toBe(503);
  });
});
