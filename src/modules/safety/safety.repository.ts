import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type {
  BoundingBox,
  HazardSeverity,
  HazardType,
  SafetyReport,
} from "../../contracts";
import { db } from "../../db";
import {
  parseGeoJsonPoint,
  stAsGeoJson,
  stDWithinMeters,
  stIntersectsBbox,
} from "../../db/postgis";
import { safetyReports } from "../../db/schema";

export type ListSafetyReportsParams = {
  trailId?: string;
  hazardType?: HazardType;
  severity?: HazardSeverity;
  activeOnly: boolean;
  bbox?: BoundingBox;
  lat?: number;
  lon?: number;
  radiusKm: number;
  limit: number;
  offset: number;
};

export type UpsertSafetyReportInput = {
  id: string;
  trailId: string | null;
  userId: string;
  hazardType: HazardType;
  severity: HazardSeverity;
  description: string;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  photoUrls: string[];
};

export interface SafetyRepository {
  list(
    params: ListSafetyReportsParams,
  ): Promise<{ items: SafetyReport[]; total: number }>;
  findById(id: string): Promise<SafetyReport | null>;
  upsert(input: UpsertSafetyReportInput): Promise<SafetyReport>;
  setResolved(
    id: string,
    isResolved: boolean,
    resolvedBy: string,
  ): Promise<SafetyReport | null>;
}

function mapSafetyRow(row: {
  id: string;
  trailId: string | null;
  userId: string;
  hazardType: HazardType;
  severity: HazardSeverity;
  description: string;
  geomJson: string;
  altitudeM: number | null;
  photoUrls: string[];
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafetyReport {
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
}

export const safetyRepository: SafetyRepository = {
  async list(params) {
    const conditions: SQL[] = [];

    if (params.trailId) {
      conditions.push(eq(safetyReports.trailId, params.trailId));
    }
    if (params.hazardType) {
      conditions.push(eq(safetyReports.hazardType, params.hazardType));
    }
    if (params.severity) {
      conditions.push(eq(safetyReports.severity, params.severity));
    }
    if (params.activeOnly) {
      conditions.push(eq(safetyReports.isResolved, false));
    }
    if (params.bbox) {
      conditions.push(stIntersectsBbox(safetyReports.geom, params.bbox));
    }
    if (params.lat !== undefined && params.lon !== undefined) {
      conditions.push(
        stDWithinMeters(
          safetyReports.geom,
          params.lon,
          params.lat,
          params.radiusKm * 1000,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(safetyReports)
      .where(whereClause);

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
      .where(whereClause)
      .orderBy(desc(safetyReports.createdAt))
      .limit(params.limit)
      .offset(params.offset);

    return { items: rows.map(mapSafetyRow), total };
  },

  async findById(id) {
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

    return row ? mapSafetyRow(row) : null;
  },

  async upsert(input) {
    const now = new Date();
    const geom = {
      type: "Point" as const,
      coordinates: [input.longitude, input.latitude] as [number, number],
    };

    await db
      .insert(safetyReports)
      .values({
        id: input.id,
        trailId: input.trailId,
        userId: input.userId,
        hazardType: input.hazardType,
        severity: input.severity,
        description: input.description,
        geom,
        altitudeM: input.altitudeM,
        photoUrls: input.photoUrls,
        isResolved: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: safetyReports.id,
        set: {
          trailId: input.trailId,
          hazardType: input.hazardType,
          severity: input.severity,
          description: input.description,
          geom,
          altitudeM: input.altitudeM,
          photoUrls: input.photoUrls,
          updatedAt: now,
        },
      });

    const saved = await this.findById(input.id);
    if (!saved) {
      throw new Error("Upserted safety report could not be loaded");
    }
    return saved;
  },

  async setResolved(id, isResolved, resolvedBy) {
    const now = new Date();
    await db
      .update(safetyReports)
      .set({
        isResolved,
        resolvedBy: isResolved ? resolvedBy : null,
        resolvedAt: isResolved ? now : null,
        updatedAt: now,
      })
      .where(eq(safetyReports.id, id));

    return this.findById(id);
  },
};
