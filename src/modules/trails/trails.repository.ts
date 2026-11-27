import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type {
  BoundingBox,
  GeoJsonLineStringZM,
  SafetyReport,
  Trail,
  TrailDifficulty,
  TrailStatus,
  TrailSummary,
  Waypoint,
  WaypointDraft,
} from "../../contracts";
import { db } from "../../db";
import {
  parseGeoJsonLineStringZM,
  parseGeoJsonPoint,
  parseGeoJsonPointZ,
  stAsGeoJson,
  stAsGeoJsonSimplified,
  stDWithinMeters,
  stIntersectsBbox,
} from "../../db/postgis";
import { safetyReports, trails, waypoints } from "../../db/schema";

export type ListTrailsParams = {
  region?: string;
  difficulty?: TrailDifficulty;
  status?: TrailStatus;
  packRegionId?: string;
  q?: string;
  bbox?: BoundingBox;
  lat?: number;
  lon?: number;
  radiusKm: number;
  simplifyTolerance?: number;
  includeGeom: boolean;
  limit: number;
  offset: number;
};

export type TrailDetailRecord = Trail & {
  waypoints: Waypoint[];
  activeHazards: SafetyReport[];
};

export type CreateTrailRecordInput = {
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
  geom: GeoJsonLineStringZM;
  status: TrailStatus;
  packRegionId: string | null;
  createdBy: string;
  waypoints: WaypointDraft[];
};

export interface TrailsRepository {
  list(
    params: ListTrailsParams,
  ): Promise<{ items: Array<Trail | TrailSummary>; total: number }>;
  findByIdOrSlug(idOrSlug: string): Promise<TrailDetailRecord | null>;
  findBySlug(slug: string): Promise<{ id: string } | null>;
  create(input: CreateTrailRecordInput): Promise<TrailDetailRecord>;
}

function mapTrailBase(row: {
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
  status: TrailStatus;
  packRegionId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): TrailSummary {
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
    status: row.status,
    packRegionId: row.packRegionId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const trailsRepository: TrailsRepository = {
  async list(params) {
    const conditions: SQL[] = [];

    if (params.region) {
      conditions.push(ilike(trails.region, `%${params.region}%`));
    }
    if (params.difficulty) {
      conditions.push(eq(trails.difficulty, params.difficulty));
    }
    if (params.status) {
      conditions.push(eq(trails.status, params.status));
    }
    if (params.packRegionId) {
      conditions.push(eq(trails.packRegionId, params.packRegionId));
    }
    if (params.q) {
      const pattern = `%${params.q}%`;
      conditions.push(
        or(
          ilike(trails.title, pattern),
          ilike(trails.region, pattern),
          ilike(trails.description, pattern),
        )!,
      );
    }
    if (params.bbox) {
      conditions.push(stIntersectsBbox(trails.geom, params.bbox));
    }
    if (params.lat !== undefined && params.lon !== undefined) {
      conditions.push(
        stDWithinMeters(
          trails.geom,
          params.lon,
          params.lat,
          params.radiusKm * 1000,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(trails)
      .where(whereClause);

    const geomExpr = params.includeGeom
      ? params.simplifyTolerance && params.simplifyTolerance > 0
        ? stAsGeoJsonSimplified(trails.geom, params.simplifyTolerance)
        : stAsGeoJson(trails.geom)
      : sql<string | null>`NULL`;

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
        status: trails.status,
        packRegionId: trails.packRegionId,
        createdBy: trails.createdBy,
        createdAt: trails.createdAt,
        updatedAt: trails.updatedAt,
        geomJson: geomExpr,
      })
      .from(trails)
      .where(whereClause)
      .orderBy(desc(trails.updatedAt))
      .limit(params.limit)
      .offset(params.offset);

    const items = rows.map((row) => {
      const summary = mapTrailBase(row);
      if (params.includeGeom && row.geomJson) {
        return {
          ...summary,
          geom: parseGeoJsonLineStringZM(row.geomJson),
        } satisfies Trail;
      }
      return summary;
    });

    return { items, total };
  },

  async findByIdOrSlug(idOrSlug) {
    const [trailRow] = await db
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
        status: trails.status,
        packRegionId: trails.packRegionId,
        createdBy: trails.createdBy,
        createdAt: trails.createdAt,
        updatedAt: trails.updatedAt,
        geomJson: stAsGeoJson(trails.geom),
      })
      .from(trails)
      .where(or(eq(trails.id, idOrSlug), eq(trails.slug, idOrSlug)))
      .limit(1);

    if (!trailRow) return null;

    const waypointRows = await db
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
      .where(eq(waypoints.trailId, trailRow.id));

    const hazardRows = await db
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
          eq(safetyReports.trailId, trailRow.id),
          eq(safetyReports.isResolved, false),
        ),
      )
      .orderBy(desc(safetyReports.createdAt));

    return {
      ...mapTrailBase(trailRow),
      geom: parseGeoJsonLineStringZM(trailRow.geomJson),
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
      activeHazards: hazardRows.map((hz) => ({
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

  async findBySlug(slug) {
    const [existing] = await db
      .select({ id: trails.id })
      .from(trails)
      .where(eq(trails.slug, slug))
      .limit(1);
    return existing ?? null;
  },

  async create(input) {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(trails).values({
        id: input.id,
        title: input.title,
        slug: input.slug,
        region: input.region,
        description: input.description,
        difficulty: input.difficulty,
        distanceKm: input.distanceKm,
        elevationGainM: input.elevationGainM,
        elevationLossM: input.elevationLossM,
        minAltitudeM: input.minAltitudeM,
        maxAltitudeM: input.maxAltitudeM,
        bbox: input.bbox,
        geom: input.geom,
        status: input.status,
        packRegionId: input.packRegionId,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      });

      if (input.waypoints.length > 0) {
        await tx.insert(waypoints).values(
          input.waypoints.map((wp) => ({
            id: `wp-${crypto.randomUUID()}`,
            trailId: input.id,
            region: input.region,
            category: wp.category,
            name: wp.name,
            description: wp.description,
            geom: {
              type: "Point" as const,
              coordinates: [wp.longitude, wp.latitude, wp.altitudeM] as [
                number,
                number,
                number,
              ],
            },
            altitudeM: wp.altitudeM,
            photoUrls: wp.photoUrls,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    });

    const created = await this.findByIdOrSlug(input.id);
    if (!created) {
      throw new Error("Created trail could not be loaded");
    }
    return created;
  },
};
