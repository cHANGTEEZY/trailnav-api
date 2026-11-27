import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type {
  GeoJsonLineStringZM,
  GpxTrack,
  GpxTrackPoint,
  GpxWaypoint,
  Position4D,
  Waypoint,
} from "../../contracts";
import { haversineDistanceMeters } from "./metrics";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
});

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function toIsoOrNull(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxParseError";
  }
}

export function parseGpxXml(xml: string): GpxTrack {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new GpxParseError("Malformed GPX XML payload");
  }

  const gpx = doc?.gpx as Record<string, unknown> | undefined;
  if (!gpx || typeof gpx !== "object") {
    throw new GpxParseError("Missing root <gpx> element");
  }

  const tracks = asArray(gpx.trk as Record<string, unknown> | Record<string, unknown>[]);
  const primaryTrack = tracks[0];
  if (!primaryTrack) {
    throw new GpxParseError("GPX document contains no <trk> element");
  }

  const segments = asArray(
    primaryTrack.trkseg as Record<string, unknown> | Record<string, unknown>[],
  );
  const points: GpxTrackPoint[] = [];

  for (const seg of segments) {
    const trkpts = asArray(
      seg?.trkpt as Record<string, unknown> | Record<string, unknown>[],
    );
    for (const pt of trkpts) {
      const lat = Number(pt["@_lat"]);
      const lon = Number(pt["@_lon"]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

      const rawEle = pt.ele !== undefined ? Number(pt.ele) : null;
      const elevationM =
        rawEle !== null && Number.isFinite(rawEle) && rawEle >= -500 && rawEle <= 9000
          ? rawEle
          : null;

      points.push({
        latitude: lat,
        longitude: lon,
        elevationM,
        time: toIsoOrNull(pt.time),
      });
    }
  }

  if (points.length < 2) {
    throw new GpxParseError("GPX track must contain at least 2 valid track points");
  }

  const rawWaypoints = asArray(
    gpx.wpt as Record<string, unknown> | Record<string, unknown>[],
  );
  const waypoints: GpxWaypoint[] = [];

  for (const wpt of rawWaypoints) {
    const lat = Number(wpt["@_lat"]);
    const lon = Number(wpt["@_lon"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const rawEle = wpt.ele !== undefined ? Number(wpt.ele) : null;
    waypoints.push({
      name: String(wpt.name ?? "Waypoint").trim() || "Waypoint",
      description: wpt.desc ? String(wpt.desc) : null,
      latitude: lat,
      longitude: lon,
      elevationM: rawEle !== null && Number.isFinite(rawEle) ? rawEle : null,
      time: toIsoOrNull(wpt.time),
      symbol: wpt.sym ? String(wpt.sym) : null,
    });
  }

  const metadata = gpx.metadata as Record<string, unknown> | undefined;
  const name =
    String(primaryTrack.name ?? metadata?.name ?? "Imported Trek").trim() ||
    "Imported Trek";
  const description = primaryTrack.desc
    ? String(primaryTrack.desc)
    : metadata?.desc
      ? String(metadata.desc)
      : null;

  return {
    name,
    description,
    points,
    waypoints,
  };
}

export function gpxTrackToLineStringZM(track: GpxTrack): GeoJsonLineStringZM {
  let cumulativeM = 0;
  const coordinates: Position4D[] = [];

  for (let i = 0; i < track.points.length; i++) {
    const pt = track.points[i];
    if (i > 0) {
      const prev = track.points[i - 1];
      cumulativeM += haversineDistanceMeters(
        prev.latitude,
        prev.longitude,
        pt.latitude,
        pt.longitude,
      );
    }
    coordinates.push([
      pt.longitude,
      pt.latitude,
      pt.elevationM ?? 0,
      Math.round(cumulativeM),
    ]);
  }

  return {
    type: "LineString",
    coordinates,
  };
}

export function serializeToGpxXml(input: {
  name: string;
  description?: string | null;
  line: GeoJsonLineStringZM;
  waypoints?: Pick<
    Waypoint,
    "name" | "description" | "geom" | "altitudeM" | "category"
  >[];
  startedAtIso?: string;
}): string {
  const gpxObject: Record<string, unknown> = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    gpx: {
      "@_version": "1.1",
      "@_creator": "TrailNav Nepal API",
      "@_xmlns": "http://www.topografix.com/GPX/1/1",
      metadata: {
        name: input.name,
        ...(input.description ? { desc: input.description } : {}),
        time: input.startedAtIso ?? new Date().toISOString(),
      },
      ...(input.waypoints && input.waypoints.length > 0
        ? {
            wpt: input.waypoints.map((wp) => ({
              "@_lat": wp.geom.coordinates[1],
              "@_lon": wp.geom.coordinates[0],
              ele: wp.altitudeM,
              name: wp.name,
              ...(wp.description ? { desc: wp.description } : {}),
              sym: wp.category,
            })),
          }
        : {}),
      trk: {
        name: input.name,
        ...(input.description ? { desc: input.description } : {}),
        trkseg: {
          trkpt: input.line.coordinates.map(([lon, lat, alt]) => ({
            "@_lat": lat,
            "@_lon": lon,
            ele: alt,
          })),
        },
      },
    },
  };

  return builder.build(gpxObject) as string;
}
