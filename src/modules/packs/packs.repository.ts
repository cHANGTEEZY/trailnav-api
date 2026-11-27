import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  RegionalPackManifest,
  SafetyReport,
  Trail,
  Waypoint,
} from "../../contracts";
import { db } from "../../db";
import {
  parseGeoJsonLineStringZM,
  parseGeoJsonPoint,
  parseGeoJsonPointZ,
  stAsGeoJson,
} from "../../db/postgis";
import {
  regionalPacks,
  safetyReports,
  trails,
  waypoints,
} from "../../db/schema";
import type { UpsertPackBody } from "./packs.validator";

export type RegionalPackBundle = {
  pack: RegionalPackManifest;
  generatedAt: string;
  trails: Trail[];
  waypoints: Waypoint[];
  safetyReports: SafetyReport[];
};

export interface PacksRepository {
  listPublished(): Promise<RegionalPackManifest[]>;
  findById(regionId: string): Promise<RegionalPackManifest | null>;
  getBundle(regionId: string): Promise<RegionalPackBundle | null>;
  upsert(
    regionId: string,
    input: UpsertPackBody,
  ): Promise<RegionalPackManifest>;
}

function mapPackRow(row: typeof regionalPacks.$inferSelect): RegionalPackManifest {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    description: row.description,
    version: row.version,
    bounds: row.bounds,
    center: row.center,
    defaultZoom: row.defaultZoom,
    totalSizeBytes: row.totalSizeBytes,
    trailCount: row.trailCount,
    waypointCount: row.waypointCount,
    artifacts: row.artifacts,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const packsRepository: PacksRepository = {
  async listPublished() {
    const rows = await db
      .select()
      .from(regionalPacks)
      .where(eq(regionalPacks.isPublished, true))
      .orderBy(asc(regionalPacks.name));

    return rows.map(mapPackRow);
  },

  async findById(regionId) {
    const [row] = await db
      .select()
      .from(regionalPacks)
      .where(
        and(
          eq(regionalPacks.id, regionId),
          eq(regionalPacks.isPublished, true),
        ),
      )
      .limit(1);

    return row ? mapPackRow(row) : null;
  },

  async getBundle(regionId) {
    const pack = await this.findById(regionId);
    if (!pack) return null;

    const trailRows = await db
      .select({
        id: trails.id,
        title: trails.title,
        slug: trails.slug,
        region: trails.region,
        description: trails.description,
        difficulty: trails.difficulty,
        distanceKm: trails.distanceKm,
        elevationGainM: trails.elevationGainM,
        elevationLossM: trails.elevationLossM,
        minAltitudeM: trails.minAltitudeM,
        maxAltitudeM: trails.maxAltitudeM,
        bbox: trails.bbox,
        geomJson: stAsGeoJson(trails.geom),
        status: trails.status,
        packRegionId: trails.packRegionId,
        createdBy: trails.createdBy,
        createdAt: trails.createdAt,
        updatedAt: trails.updatedAt,
      })
      .from(trails)
      .where(
        and(
          eq(trails.packRegionId, regionId),
          inArray(trails.status, ["verified", "community_approved"]),
        ),
      )
      .orderBy(desc(trails.updatedAt));

    const trailIds = trailRows.map((t) => t.id);

    const waypointRows =
      trailIds.length === 0
        ? []
        : await db
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
            })
            .from(waypoints)
            .where(inArray(waypoints.trailId, trailIds));

    const hazardRows =
      trailIds.length === 0
        ? []
        : await db
            .select({
              id: safetyReports.id,
              trailId: safetyReports.trailId,
              userId: safetyReports.userId,
              hazardType: safetyReports.hazardType,
              severity: safetyReports.severity,
              description: safetyReports.description,
              geomJson: stAsGeoJson(safetyReports.geom),
              altitudeM: safetyReports.altitudeM,
              photoUrls: safetyReports.photoUrls,
              isResolved: safetyReports.isResolved,
              createdAt: safetyReports.createdAt,
              updatedAt: safetyReports.updatedAt,
            })
            .from(safetyReports)
            .where(
              and(
                inArray(safetyReports.trailId, trailIds),
                eq(safetyReports.isResolved, false),
              ),
            );

    return {
      pack,
      generatedAt: new Date().toISOString(),
      trails: trailRows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        region: row.region,
        description: row.description,
        difficulty: row.difficulty,
        distanceKm: row.distanceKm,
        elevationGainM: row.elevationGainM,
        elevationLossM: row.elevationLossM,
        minAltitudeM: row.minAltitudeM,
        maxAltitudeM: row.maxAltitudeM,
        bbox: row.bbox,
        geom: parseGeoJsonLineStringZM(row.geomJson),
        status: row.status,
        packRegionId: row.packRegionId,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      waypoints: waypointRows.map((wp) => ({
        id: wp.id,
        trailId: wp.trailId,
        region: wp.region,
        category: wp.category,
        name: wp.name,
        description: wp.description,
        geom: parseGeoJsonPointZ(wp.geomJson),
        altitudeM: wp.altitudeM,
        photoUrls: wp.photoUrls,
        createdAt: wp.createdAt.toISOString(),
        updatedAt: wp.updatedAt.toISOString(),
      })),
      safetyReports: hazardRows.map((hz) => ({
        id: hz.id,
        trailId: hz.trailId,
        userId: hz.userId,
        hazardType: hz.hazardType,
        severity: hz.severity,
        description: hz.description,
        geom: parseGeoJsonPoint(hz.geomJson),
        altitudeM: hz.altitudeM,
        photoUrls: hz.photoUrls,
        syncStatus: "synced",
        isResolved: hz.isResolved,
        createdAt: hz.createdAt.toISOString(),
        updatedAt: hz.updatedAt.toISOString(),
      })),
    };
  },

  async upsert(regionId, input) {
    const now = new Date();
    const [saved] = await db
      .insert(regionalPacks)
      .values({
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
        isPublished: input.isPublished,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: regionalPacks.id,
        set: {
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
          isPublished: input.isPublished,
          updatedAt: now,
        },
      })
      .returning();

    return mapPackRow(saved);
  },
};
