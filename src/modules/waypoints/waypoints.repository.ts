import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type {
  OfflineSearchResult,
  Waypoint,
  WaypointCategory,
} from "../../contracts";
import { db } from "../../db";
import {
  parseGeoJsonPointZ,
  stAsGeoJson,
  stDistanceMeters,
  stDWithinMeters,
} from "../../db/postgis";
import { trails, waypoints } from "../../db/schema";

export type NearbyWaypointResult = Waypoint & {
  distanceM: number;
};

export interface WaypointsRepository {
  findNearby(params: {
    lat: number;
    lon: number;
    radiusMeters: number;
    category?: WaypointCategory;
    limit: number;
  }): Promise<NearbyWaypointResult[]>;

  searchUnified(params: {
    q: string;
    region?: string;
    category?: WaypointCategory;
    kind: "all" | "trail" | "waypoint";
    limit: number;
  }): Promise<OfflineSearchResult[]>;
}

export const waypointsRepository: WaypointsRepository = {
  async findNearby({ lat, lon, radiusMeters, category, limit }) {
    const conditions: SQL[] = [
      stDWithinMeters(waypoints.geom, lon, lat, radiusMeters),
    ];

    if (category) {
      conditions.push(eq(waypoints.category, category));
    }

    const distanceExpr = stDistanceMeters(waypoints.geom, lon, lat);

    const rows = await db
      .select({
        id: waypoints.id,
        trailId: waypoints.trailId,
        region: waypoints.region,
        category: waypoints.category,
        name: waypoints.name,
        description: waypoints.description,
        geomJson: stAsGeoJson(waypoints.geom),
        altitudeM: waypoints.altitudeM,
        photoUrls: waypoints.photoUrls,
        createdAt: waypoints.createdAt,
        updatedAt: waypoints.updatedAt,
        distanceM: distanceExpr,
      })
      .from(waypoints)
      .where(and(...conditions))
      .orderBy(asc(distanceExpr))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      trailId: row.trailId,
      region: row.region,
      category: row.category,
      name: row.name,
      description: row.description,
      geom: parseGeoJsonPointZ(row.geomJson),
      altitudeM: row.altitudeM,
      photoUrls: row.photoUrls,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      distanceM: Math.round(Number(row.distanceM)),
    }));
  },

  async searchUnified({ q, region, category, kind, limit }) {
    const pattern = `%${q}%`;
    const results: OfflineSearchResult[] = [];

    if (kind === "all" || kind === "trail") {
      const trailConditions: SQL[] = [
        or(
          ilike(trails.title, pattern),
          ilike(trails.region, pattern),
          ilike(trails.description, pattern),
        )!,
      ];

      if (region) {
        trailConditions.push(ilike(trails.region, `%${region}%`));
      }

      const trailRows = await db
        .select({
          id: trails.id,
          title: trails.title,
          region: trails.region,
          difficulty: trails.difficulty,
          status: trails.status,
          maxAltitudeM: trails.maxAltitudeM,
          startLon: sql<number>`ST_X(ST_StartPoint(${trails.geom}))`,
          startLat: sql<number>`ST_Y(ST_StartPoint(${trails.geom}))`,
        })
        .from(trails)
        .where(and(...trailConditions))
        .limit(limit);

      for (const row of trailRows) {
        results.push({
          id: row.id,
          kind: "trail",
          title: row.title,
          subtitle: `${row.region} · ${row.difficulty}`,
          region: row.region,
          category: null,
          difficulty: row.difficulty,
          status: row.status,
          altitudeM: row.maxAltitudeM,
          latitude: Number(row.startLat),
          longitude: Number(row.startLon),
          trailId: row.id,
          score: row.title.toLowerCase().startsWith(q.toLowerCase()) ? 1 : 0.7,
        });
      }
    }

    if (kind === "all" || kind === "waypoint") {
      const wpConditions: SQL[] = [
        or(
          ilike(waypoints.name, pattern),
          ilike(waypoints.description, pattern),
          ilike(waypoints.region, pattern),
        )!,
      ];

      if (region) {
        wpConditions.push(ilike(waypoints.region, `%${region}%`));
      }
      if (category) {
        wpConditions.push(eq(waypoints.category, category));
      }

      const wpRows = await db
        .select({
          id: waypoints.id,
          trailId: waypoints.trailId,
          region: waypoints.region,
          category: waypoints.category,
          name: waypoints.name,
          description: waypoints.description,
          altitudeM: waypoints.altitudeM,
          lon: sql<number>`ST_X(${waypoints.geom})`,
          lat: sql<number>`ST_Y(${waypoints.geom})`,
        })
        .from(waypoints)
        .where(and(...wpConditions))
        .limit(limit);

      for (const row of wpRows) {
        results.push({
          id: row.id,
          kind: "waypoint",
          title: row.name,
          subtitle: row.description,
          region: row.region,
          category: row.category,
          difficulty: null,
          status: null,
          altitudeM: row.altitudeM,
          latitude: Number(row.lat),
          longitude: Number(row.lon),
          trailId: row.trailId,
          score: row.name.toLowerCase().startsWith(q.toLowerCase()) ? 1 : 0.75,
        });
      }
    }

    return results
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  },
};
