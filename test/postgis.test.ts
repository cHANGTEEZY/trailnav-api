import { describe, expect, it } from "bun:test";
import {
  computeBoundingBox,
  parseGeoJsonLineStringZM,
  parseGeoJsonPoint,
  parseGeoJsonPointZ,
  toEwktLineStringZM,
  toEwktPoint,
  toEwktPointZ,
} from "../src/db/postgis";

describe("PostGIS EWKT & GeoJSON helpers", () => {
  it("round-trips Point geometries", () => {
    const ewkt = toEwktPoint({ type: "Point", coordinates: [83.6938, 28.4011] });
    expect(ewkt).toBe("SRID=4326;POINT(83.6938 28.4011)");
    expect(parseGeoJsonPoint("POINT(83.6938 28.4011)")).toEqual({
      type: "Point",
      coordinates: [83.6938, 28.4011],
    });
  });

  it("round-trips PointZ geometries", () => {
    const ewkt = toEwktPointZ({
      type: "Point",
      coordinates: [83.6894, 28.4004, 3210],
    });
    expect(ewkt).toBe("SRID=4326;POINT Z(83.6894 28.4004 3210)");
    expect(parseGeoJsonPointZ("POINT Z(83.6894 28.4004 3210)")).toEqual({
      type: "Point",
      coordinates: [83.6894, 28.4004, 3210],
    });
  });

  it("round-trips LineStringZM geometries and computes bounding boxes", () => {
    const line = {
      type: "LineString" as const,
      coordinates: [
        [83.7769, 28.3008, 1070, 0] as [number, number, number, number],
        [83.6894, 28.4004, 3210, 19400] as [number, number, number, number],
      ],
    };

    const ewkt = toEwktLineStringZM(line);
    expect(ewkt).toBe(
      "SRID=4326;LINESTRING ZM(83.7769 28.3008 1070 0, 83.6894 28.4004 3210 19400)",
    );

    expect(parseGeoJsonLineStringZM(ewkt)).toEqual(line);
    expect(computeBoundingBox(line.coordinates)).toEqual([
      83.6894, 28.3008, 83.7769, 28.4004,
    ]);
  });
});
