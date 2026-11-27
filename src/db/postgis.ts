import { sql, type SQL } from "drizzle-orm";
import { customType, type AnyPgColumn } from "drizzle-orm/pg-core";
import type {
  BoundingBox,
  GeoJsonLineStringZM,
  GeoJsonPoint,
  GeoJsonPointZ,
  Position2D,
  Position3D,
  Position4D,
} from "../contracts";

export function toEwktPoint(point: GeoJsonPoint): string {
  const [lon, lat] = point.coordinates;
  return `SRID=4326;POINT(${lon} ${lat})`;
}

export function toEwktPointZ(point: GeoJsonPointZ): string {
  const [lon, lat, alt] = point.coordinates;
  return `SRID=4326;POINT Z(${lon} ${lat} ${alt})`;
}

export function toEwktLineStringZM(line: GeoJsonLineStringZM): string {
  const coords = line.coordinates
    .map(([lon, lat, alt, measure]) => `${lon} ${lat} ${alt} ${measure}`)
    .join(", ");
  return `SRID=4326;LINESTRING ZM(${coords})`;
}

export function parseGeoJsonPoint(raw: unknown): GeoJsonPoint {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as GeoJsonPoint;
    }
    const match = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return {
        type: "Point",
        coordinates: [Number(match[1]), Number(match[2])] as Position2D,
      };
    }
  }
  return raw as GeoJsonPoint;
}

export function parseGeoJsonPointZ(raw: unknown): GeoJsonPointZ {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as GeoJsonPointZ;
    }
    const match = trimmed.match(
      /POINT\s*Z?\s*\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\)/i,
    );
    if (match) {
      return {
        type: "Point",
        coordinates: [
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
        ] as Position3D,
      };
    }
  }
  return raw as GeoJsonPointZ;
}

export function parseGeoJsonLineStringZM(raw: unknown): GeoJsonLineStringZM {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as GeoJsonLineStringZM;
    }
    const match = trimmed.match(/LINESTRING\s*ZM\s*\((.+)\)/i);
    if (match) {
      const coordinates = match[1].split(",").map((segment) => {
        const parts = segment.trim().split(/\s+/).map(Number);
        return [
          parts[0] ?? 0,
          parts[1] ?? 0,
          parts[2] ?? 0,
          parts[3] ?? 0,
        ] as Position4D;
      });
      return { type: "LineString", coordinates };
    }
  }
  return raw as GeoJsonLineStringZM;
}

export const geometryPoint = customType<{
  data: GeoJsonPoint;
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value: GeoJsonPoint): string {
    return toEwktPoint(value);
  },
  fromDriver(value: string): GeoJsonPoint {
    return parseGeoJsonPoint(value);
  },
});

export const geometryPointZ = customType<{
  data: GeoJsonPointZ;
  driverData: string;
}>({
  dataType() {
    return "geometry(PointZ, 4326)";
  },
  toDriver(value: GeoJsonPointZ): string {
    return toEwktPointZ(value);
  },
  fromDriver(value: string): GeoJsonPointZ {
    return parseGeoJsonPointZ(value);
  },
});

export const geometryLineStringZM = customType<{
  data: GeoJsonLineStringZM;
  driverData: string;
}>({
  dataType() {
    return "geometry(LineStringZM, 4326)";
  },
  toDriver(value: GeoJsonLineStringZM): string {
    return toEwktLineStringZM(value);
  },
  fromDriver(value: string): GeoJsonLineStringZM {
    return parseGeoJsonLineStringZM(value);
  },
});

export function stAsGeoJson(column: AnyPgColumn): SQL<string> {
  return sql<string>`ST_AsGeoJSON(${column})`;
}

export function stAsGeoJsonSimplified(
  column: AnyPgColumn,
  toleranceDeg: number,
): SQL<string> {
  return sql<string>`ST_AsGeoJSON(ST_SimplifyPreserveTopology(${column}, ${toleranceDeg}))`;
}

export function stIntersectsBbox(
  column: AnyPgColumn,
  bbox: BoundingBox,
): SQL {
  const [west, south, east, north] = bbox;
  return sql`ST_Intersects(${column}, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))`;
}

export function stDWithinMeters(
  column: AnyPgColumn,
  lon: number,
  lat: number,
  radiusMeters: number,
): SQL {
  return sql`ST_DWithin(${column}::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography, ${radiusMeters})`;
}

export function stDistanceMeters(
  column: AnyPgColumn,
  lon: number,
  lat: number,
): SQL<number> {
  return sql<number>`ST_Distance(${column}::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography)`;
}

export function computeBoundingBox(
  coordinates: Position4D[],
): BoundingBox | null {
  if (coordinates.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const [lon, lat] of coordinates) {
    if (lon < west) west = lon;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lat > north) north = lat;
  }

  return [west, south, east, north];
}
