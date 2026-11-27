import { asc, desc, eq } from "drizzle-orm";
import type {
  BoundingBox,
  GeoJsonLineStringZM,
  HazardSeverity,
  SafetyReport,
  Trail,
  TrailDifficulty,
  TrailStatus,
} from "../../contracts";
import { db } from "../../db";
import {
  parseGeoJsonLineStringZM,
  parseGeoJsonPoint,
  stAsGeoJson,
} from "../../db/postgis";
import { safetyReports, trails } from "../../db/schema";

export type TrailReviewPatch = {
  status: TrailStatus;
  reviewedBy: string;
  reviewedAt: Date;
  reviewNotes: string | null;
  title?: string;
  region?: string;
  difficulty?: TrailDifficulty;
  packRegionId?: string | null;
  geom?: GeoJsonLineStringZM;
  bbox?: BoundingBox | null;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  minAltitudeM?: number;
  maxAltitudeM?: number;
};

export type HazardTriagePatch = {
  severity?: HazardSeverity;
  isResolved?: boolean;
  description?: string;
  actorId: string;
};

export interface ModerationRepository {
  listPendingTrails(limit: number): Promise<Trail[]>;
  listUnresolvedHazards(limit: number): Promise<SafetyReport[]>;
  findTrailById(id: string): Promise<Trail | null>;
  applyTrailReview(id: string, patch: TrailReviewPatch): Promise<Trail | null>;
  deleteTrail(id: string): Promise<boolean>;
  triageHazard(
    id: string,
    patch: HazardTriagePatch,
  ): Promise<SafetyReport | null>;
}

function mapTrailRow(row: {
  id: string;
  title: string;
  slug: string;
  region: string;
  description: string | null;
  difficulty: TrailDifficulty;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number | null;
  minAltitudeM: number | null;
  maxAltitudeM: number;
  bbox: BoundingBox | null;
  geomJson: string;
  status: TrailStatus;
  packRegionId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Trail {
  return {
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
  };
}

export const moderationRepository: ModerationRepository = {
  async listPendingTrails(limit) {
    const rows = await db
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
      .where(eq(trails.status, "community_pending"))
      .orderBy(asc(trails.createdAt))
      .limit(limit);

    return rows.map(mapTrailRow);
  },

  async listUnresolvedHazards(limit) {
    const rows = await db
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
      .where(eq(safetyReports.isResolved, false))
      .orderBy(desc(safetyReports.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      trailId: row.trailId,
      userId: row.userId,
      hazardType: row.hazardType,
      severity: row.severity,
      description: row.description,
      geom: parseGeoJsonPoint(row.geomJson),
      altitudeM: row.altitudeM,
      photoUrls: row.photoUrls,
      syncStatus: "synced",
      isResolved: row.isResolved,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  async findTrailById(id) {
    const [row] = await db
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
      .where(eq(trails.id, id))
      .limit(1);

    return row ? mapTrailRow(row) : null;
  },

  async applyTrailReview(id, patch) {
    await db
      .update(trails)
      .set({
        status: patch.status,
        reviewedBy: patch.reviewedBy,
        reviewedAt: patch.reviewedAt,
        reviewNotes: patch.reviewNotes,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.region !== undefined ? { region: patch.region } : {}),
        ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
        ...(patch.packRegionId !== undefined
          ? { packRegionId: patch.packRegionId }
          : {}),
        ...(patch.geom !== undefined ? { geom: patch.geom } : {}),
        ...(patch.bbox !== undefined ? { bbox: patch.bbox } : {}),
        ...(patch.distanceKm !== undefined ? { distanceKm: patch.distanceKm } : {}),
        ...(patch.elevationGainM !== undefined
          ? { elevationGainM: patch.elevationGainM }
          : {}),
        ...(patch.elevationLossM !== undefined
          ? { elevationLossM: patch.elevationLossM }
          : {}),
        ...(patch.minAltitudeM !== undefined
          ? { minAltitudeM: patch.minAltitudeM }
          : {}),
        ...(patch.maxAltitudeM !== undefined
          ? { maxAltitudeM: patch.maxAltitudeM }
          : {}),
        updatedAt: patch.reviewedAt,
      })
      .where(eq(trails.id, id));

    return this.findTrailById(id);
  },

  async deleteTrail(id) {
    const deleted = await db
      .delete(trails)
      .where(eq(trails.id, id))
      .returning({ id: trails.id });
    return deleted.length > 0;
  },

  async triageHazard(id, patch) {
    const now = new Date();
    await db
      .update(safetyReports)
      .set({
        ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        ...(patch.isResolved !== undefined
          ? {
              isResolved: patch.isResolved,
              resolvedBy: patch.isResolved ? patch.actorId : null,
              resolvedAt: patch.isResolved ? now : null,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(safetyReports.id, id));

    const [row] = await db
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
      .where(eq(safetyReports.id, id))
      .limit(1);

    if (!row) return null;
    return {
      id: row.id,
      trailId: row.trailId,
      userId: row.userId,
      hazardType: row.hazardType,
      severity: row.severity,
      description: row.description,
      geom: parseGeoJsonPoint(row.geomJson),
      altitudeM: row.altitudeM,
      photoUrls: row.photoUrls,
      syncStatus: "synced",
      isResolved: row.isResolved,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },
};
