import { describe, expect, it } from "bun:test";
import {
  PackCatalogSchema,
  SafetyReportSchema,
  SyncBatchRequestSchema,
  TrailSchema,
  WaypointSchema,
} from "../src/contracts";
import {
  buildSeedRegionalPacks,
  SEED_POON_HILL_HAZARD,
  SEED_POON_HILL_TRAIL,
  SEED_POON_HILL_WAYPOINTS,
} from "../src/db/seed-data";

describe("shared mobile/backend contracts", () => {
  it("validates the Ghorepani Poon Hill seed trail", () => {
    const parsed = TrailSchema.parse(SEED_POON_HILL_TRAIL);
    expect(parsed.slug).toBe("ghorepani-poon-hill-loop");
    expect(parsed.geom.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(parsed.maxAltitudeM).toBe(3210);
  });

  it("validates all Poon Hill waypoints and hazard fixture", () => {
    for (const waypoint of SEED_POON_HILL_WAYPOINTS) {
      const parsed = WaypointSchema.parse(waypoint);
      expect(parsed.geom.coordinates).toHaveLength(3);
    }

    const hazard = SafetyReportSchema.parse(SEED_POON_HILL_HAZARD);
    expect(hazard.hazardType).toBe("snow_ice");
  });

  it("validates the 5 regional Nepal pack manifests", () => {
    const catalog = PackCatalogSchema.parse({
      version: "2026.10.1",
      generatedAt: "2026-10-15T00:00:00.000Z",
      packs: buildSeedRegionalPacks(),
    });
    expect(catalog.packs).toHaveLength(5);
  });

  it("rejects out-of-range Himalayan altitude and invalid sync batches", () => {
    expect(() =>
      WaypointSchema.parse({
        ...SEED_POON_HILL_WAYPOINTS[0],
        geom: { type: "Point", coordinates: [86.925, 27.988, 12000] },
      }),
    ).toThrow();

    const batch = SyncBatchRequestSchema.parse({
      deviceId: "iphone-16-pro",
      items: [
        {
          clientEventId: "evt-1",
          entityType: "safety_report",
          entityId: "hazard-1",
          operation: "create",
          payload: { hazardType: "landslide" },
          clientUpdatedAt: "2026-10-15T08:00:00.000Z",
        },
      ],
    });
    expect(batch.items).toHaveLength(1);
  });
});
