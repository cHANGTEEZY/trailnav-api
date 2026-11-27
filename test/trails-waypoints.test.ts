import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import {
  SEED_POON_HILL_HAZARD,
  SEED_POON_HILL_TRAIL,
  SEED_POON_HILL_WAYPOINTS,
} from "../src/db/seed-data";
import { createTrailsController } from "../src/modules/trails/trails.controller";
import type {
  TrailDetailRecord,
  TrailsRepository,
} from "../src/modules/trails/trails.repository";
import { createTrailsRoutes } from "../src/modules/trails/trails.routes";
import { createTrailsService, slugifyTitle } from "../src/modules/trails/trails.service";
import {
  listTrailsQuerySchema,
  parseBboxParam,
} from "../src/modules/trails/trails.validator";
import { createWaypointsController } from "../src/modules/waypoints/waypoints.controller";
import type { WaypointsRepository } from "../src/modules/waypoints/waypoints.repository";
import {
  createSearchRoutes,
  createWaypointsRoutes,
} from "../src/modules/waypoints/waypoints.routes";
import { createWaypointsService } from "../src/modules/waypoints/waypoints.service";
import type { AppVariables } from "../src/shared/types/app.types";

function mountTestApp(options: {
  trailsRepo?: TrailsRepository;
  waypointsRepo?: WaypointsRepository;
  role?: "trekker" | "moderator" | "admin" | null;
}) {
  const testApp = new Hono<{ Variables: AppVariables }>();

  testApp.use("*", async (c, next) => {
    c.set("requestId", "req-spatial-test");
    c.set(
      "user",
      options.role
        ? ({
            id: "user-trekker-1",
            name: "Tenzing Sherpa",
            email: "tenzing@trailnav.np",
            emailVerified: true,
            image: null,
            role: options.role,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as AppVariables["user"])
        : null,
    );
    c.set("session", null);
    await next();
  });

  if (options.trailsRepo) {
    const service = createTrailsService(options.trailsRepo);
    testApp.route("/trails", createTrailsRoutes(createTrailsController(service)));
  }

  if (options.waypointsRepo) {
    const wpService = createWaypointsService(options.waypointsRepo);
    const wpController = createWaypointsController(wpService);
    testApp.route("/waypoints", createWaypointsRoutes(wpController));
    testApp.route("/search", createSearchRoutes(wpController));
  }

  return testApp;
}

describe("trails & waypoints validators", () => {
  it("parses valid bounding boxes and rejects inverted ones", () => {
    expect(parseBboxParam("83.63,28.31,83.86,28.47")).toEqual([
      83.63, 28.31, 83.86, 28.47,
    ]);
    expect(parseBboxParam("84.0,28.5,83.5,28.1")).toBeNull();
    expect(parseBboxParam("83.63,28.31")).toBeNull();
  });

  it("rejects partial proximity coordinates (lat without lon)", () => {
    const parsed = listTrailsQuerySchema.safeParse({ lat: "28.4" });
    expect(parsed.success).toBe(false);
  });

  it("slugifies trail titles cleanly", () => {
    expect(slugifyTitle("Ghorepani / Poon Hill Loop!")).toBe(
      "ghorepani-poon-hill-loop",
    );
  });
});

describe("trails HTTP routes", () => {
  const seedDetail: TrailDetailRecord = {
    ...SEED_POON_HILL_TRAIL,
    waypoints: SEED_POON_HILL_WAYPOINTS,
    activeHazards: [SEED_POON_HILL_HAZARD],
  };

  const mockTrailsRepo: TrailsRepository = {
    async list() {
      const { geom: _geom, ...summary } = SEED_POON_HILL_TRAIL;
      return { items: [summary], total: 1 };
    },
    async findByIdOrSlug(idOrSlug) {
      if (
        idOrSlug === SEED_POON_HILL_TRAIL.id ||
        idOrSlug === SEED_POON_HILL_TRAIL.slug
      ) {
        return seedDetail;
      }
      return null;
    },
    async findBySlug(slug) {
      return slug === SEED_POON_HILL_TRAIL.slug
        ? { id: SEED_POON_HILL_TRAIL.id }
        : null;
    },
    async create(input) {
      const now = new Date().toISOString();
      return {
        ...input,
        createdAt: now,
        updatedAt: now,
        waypoints: [],
        activeHazards: [],
      };
    },
  };

  it("lists trails with pagination metadata", async () => {
    const testApp = mountTestApp({ trailsRepo: mockTrailsRepo });
    const res = await testApp.request(
      "/trails?region=Annapurna&bbox=83.6,28.3,83.9,28.5",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ slug: string }>;
      meta: { total: number; hasMore: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("ghorepani-poon-hill-loop");
    expect(body.meta.total).toBe(1);
  });

  it("returns trail details with waypoints and hazards, or 404 when missing", async () => {
    const testApp = mountTestApp({ trailsRepo: mockTrailsRepo });
    const okRes = await testApp.request("/trails/ghorepani-poon-hill-loop");
    expect(okRes.status).toBe(200);
    const okBody = (await okRes.json()) as {
      data: TrailDetailRecord;
    };
    expect(okBody.data.waypoints).toHaveLength(8);
    expect(okBody.data.activeHazards).toHaveLength(1);

    const missingRes = await testApp.request("/trails/non-existent-ridge");
    expect(missingRes.status).toBe(404);
  });

  it("sets community_pending status for trekker submissions and rejects duplicate slugs", async () => {
    const testApp = mountTestApp({
      trailsRepo: mockTrailsRepo,
      role: "trekker",
    });

    const createRes = await testApp.request("/trails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Mardi Himal High Camp Ridge",
        region: "Annapurna",
        difficulty: "hard",
        distanceKm: 18.5,
        elevationGainM: 1450,
        maxAltitudeM: 4500,
        geom: {
          type: "LineString",
          coordinates: [
            [83.92, 28.42, 3050, 0],
            [83.93, 28.46, 4500, 18500],
          ],
        },
      }),
    });

    expect(createRes.status).toBe(201);
    const createdBody = (await createRes.json()) as {
      data: { status: string; slug: string };
    };
    expect(createdBody.data.status).toBe("community_pending");
    expect(createdBody.data.slug).toBe("mardi-himal-high-camp-ridge");

    const dupRes = await testApp.request("/trails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Ghorepani / Poon Hill Loop",
        slug: "ghorepani-poon-hill-loop",
        region: "Annapurna",
        difficulty: "moderate",
        distanceKm: 36.2,
        elevationGainM: 2356,
        maxAltitudeM: 3210,
        geom: SEED_POON_HILL_TRAIL.geom,
      }),
    });
    expect(dupRes.status).toBe(409);
  });
});

describe("waypoints & unified search routes", () => {
  const mockWaypointsRepo: WaypointsRepository = {
    async findNearby() {
      return [
        {
          ...SEED_POON_HILL_WAYPOINTS[4],
          distanceM: 420,
        },
      ];
    },
    async searchUnified() {
      return [
        {
          id: SEED_POON_HILL_TRAIL.id,
          kind: "trail",
          title: SEED_POON_HILL_TRAIL.title,
          subtitle: "Annapurna · moderate",
          region: "Annapurna",
          category: null,
          difficulty: "moderate",
          status: "verified",
          altitudeM: 3210,
          latitude: 28.3008,
          longitude: 83.7769,
          trailId: SEED_POON_HILL_TRAIL.id,
          score: 1,
        },
      ];
    },
  };

  it("returns nearby waypoints sorted by distance", async () => {
    const testApp = mountTestApp({ waypointsRepo: mockWaypointsRepo });
    const res = await testApp.request(
      "/waypoints/nearby?lat=28.4004&lon=83.6894&category=teahouse",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ name: string; distanceM: number }>;
    };
    expect(body.data[0].distanceM).toBe(420);
  });

  it("returns 400 when search query is missing and 200 when provided", async () => {
    const testApp = mountTestApp({ waypointsRepo: mockWaypointsRepo });
    const badRes = await testApp.request("/search");
    expect(badRes.status).toBe(400);

    const okRes = await testApp.request("/search?q=Poon");
    expect(okRes.status).toBe(200);
    const body = (await okRes.json()) as { data: Array<{ kind: string }> };
    expect(body.data[0].kind).toBe("trail");
  });
});
