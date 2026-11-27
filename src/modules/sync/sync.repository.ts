import { and, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type {
  RecordedTrack,
  SafetyReport,
  SyncBatchItemStatus,
  SyncEntityType,
  SyncOperation,
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
  recordedTracks,
  safetyReports,
  syncEvents,
  trails,
  waypoints,
} from "../../db/schema";
import {
  safetyRepository,
  type UpsertSafetyReportInput,
} from "../safety/safety.repository";
import {
  tracksRepository,
  type UpsertTrackInput,
} from "../tracks/tracks.repository";

export type SyncEventRecord = {
  clientEventId: string;
  userId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  status: SyncBatchItemStatus;
  serverId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type SyncDeltaPullResult = {
  syncedAt: string;
  trails: Trail[];
  waypoints: Waypoint[];
  safetyReports: SafetyReport[];
  tracks: RecordedTrack[];
};

export interface SyncRepository {
  findEventByClientId(clientEventId: string): Promise<SyncEventRecord | null>;
  recordEvent(event: SyncEventRecord): Promise<void>;
  findTrackOwnerAndUpdatedAt(
    id: string,
  ): Promise<{ userId: string; updatedAt: Date } | null>;
  upsertTrack(input: UpsertTrackInput): Promise<{ id: string }>;
  deleteTrack(id: string): Promise<boolean>;
  findSafetyReportOwnerAndUpdatedAt(
    id: string,
  ): Promise<{ userId: string; updatedAt: Date } | null>;
  upsertSafetyReport(input: UpsertSafetyReportInput): Promise<{ id: string }>;
  deleteSafetyReport(id: string): Promise<boolean>;
  attachPhotoUrl(
    targetType: "waypoint" | "safety_report",
    entityId: string,
    photoUrl: string,
  ): Promise<boolean>;
  pullDelta(params: {
    userId: string;
    since?: Date;
    packRegionId?: string;
    limit: number;
  }): Promise<SyncDeltaPullResult>;
}

export const syncRepository: SyncRepository = {
  async findEventByClientId(clientEventId) {
    const [row] = await db
      .select()
      .from(syncEvents)
      .where(eq(syncEvents.clientEventId, clientEventId))
      .limit(1);
    return row ?? null;
  },

  async recordEvent(event) {
    await db
      .insert(syncEvents)
      .values({
        clientEventId: event.clientEventId,
        userId: event.userId,
        deviceId: event.deviceId,
        entityType: event.entityType,
        entityId: event.entityId,
        operation: event.operation,
        status: event.status,
        serverId: event.serverId,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
      })
      .onConflictDoNothing({ target: syncEvents.clientEventId });
  },

  async findTrackOwnerAndUpdatedAt(id) {
    const [row] = await db
      .select({
        userId: recordedTracks.userId,
        updatedAt: recordedTracks.updatedAt,
      })
      .from(recordedTracks)
      .where(eq(recordedTracks.id, id))
      .limit(1);
    return row ?? null;
  },

  async upsertTrack(input) {
    const saved = await tracksRepository.upsert(input);
    return { id: saved.id };
  },

  async deleteTrack(id) {
    return tracksRepository.remove(id);
  },

  async findSafetyReportOwnerAndUpdatedAt(id) {
    const [row] = await db
      .select({
        userId: safetyReports.userId,
        updatedAt: safetyReports.updatedAt,
      })
      .from(safetyReports)
      .where(eq(safetyReports.id, id))
      .limit(1);
    return row ?? null;
  },

  async upsertSafetyReport(input) {
    const saved = await safetyRepository.upsert(input);
    return { id: saved.id };
  },

  async deleteSafetyReport(id) {
    const deleted = await db
      .delete(safetyReports)
      .where(eq(safetyReports.id, id))
      .returning({ id: safetyReports.id });
    return deleted.length > 0;
  },

  async attachPhotoUrl(targetType, entityId, photoUrl) {
    const now = new Date();
    if (targetType === "safety_report") {
      const updated = await db
        .update(safetyReports)
        .set({
          photoUrls: sql`CASE WHEN ${photoUrl} = ANY(${safetyReports.photoUrls}) THEN ${safetyReports.photoUrls} ELSE array_append(${safetyReports.photoUrls}, ${photoUrl}) END`,
          updatedAt: now,
        })
        .where(eq(safetyReports.id, entityId))
        .returning({ id: safetyReports.id });
      return updated.length > 0;
    }

    const updated = await db
      .update(waypoints)
      .set({
        photoUrls: sql`CASE WHEN ${photoUrl} = ANY(${waypoints.photoUrls}) THEN ${waypoints.photoUrls} ELSE array_append(${waypoints.photoUrls}, ${photoUrl}) END`,
        updatedAt: now,
      })
      .where(eq(waypoints.id, entityId))
      .returning({ id: waypoints.id });
    return updated.length > 0;
  },

  async pullDelta({ userId, since, packRegionId, limit }) {
    const trailConditions: SQL[] = [
      inArray(trails.status, ["verified", "community_approved"]),
    ];
    if (since) trailConditions.push(gt(trails.updatedAt, since));
    if (packRegionId) {
      trailConditions.push(eq(trails.packRegionId, packRegionId));
    }

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
      .where(and(...trailConditions))
      .orderBy(desc(trails.updatedAt))
      .limit(limit);

    const trailIds = trailRows.map((t) => t.id);

    const wpConditions: SQL[] = [];
    if (since) wpConditions.push(gt(waypoints.updatedAt, since));
    if (packRegionId && trailIds.length > 0) {
      wpConditions.push(inArray(waypoints.trailId, trailIds));
    }

    const waypointRows =
      packRegionId && trailIds.length === 0
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
            .where(wpConditions.length > 0 ? and(...wpConditions) : undefined)
            .orderBy(desc(waypoints.updatedAt))
            .limit(limit);

    const hazardConditions: SQL[] = [];
    if (since) hazardConditions.push(gt(safetyReports.updatedAt, since));
    if (packRegionId && trailIds.length > 0) {
      hazardConditions.push(inArray(safetyReports.trailId, trailIds));
    }

    const hazardRows =
      packRegionId && trailIds.length === 0
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
              hazardConditions.length > 0 ? and(...hazardConditions) : undefined,
            )
            .orderBy(desc(safetyReports.updatedAt))
            .limit(limit);

    const trackConditions: SQL[] = [eq(recordedTracks.userId, userId)];
    if (since) trackConditions.push(gt(recordedTracks.updatedAt, since));

    const trackRows = await db
      .select({
        id: recordedTracks.id,
        userId: recordedTracks.userId,
        trailId: recordedTracks.trailId,
        title: recordedTracks.title,
        notes: recordedTracks.notes,
        difficulty: recordedTracks.difficulty,
        startedAt: recordedTracks.startedAt,
        endedAt: recordedTracks.endedAt,
        movingTimeSeconds: recordedTracks.movingTimeSeconds,
        elapsedTimeSeconds: recordedTracks.elapsedTimeSeconds,
        totalDistanceKm: recordedTracks.totalDistanceKm,
        elevationGainM: recordedTracks.elevationGainM,
        elevationLossM: recordedTracks.elevationLossM,
        maxAltitudeM: recordedTracks.maxAltitudeM,
        minAltitudeM: recordedTracks.minAltitudeM,
        geomJson: sql<string | null>`CASE WHEN ${recordedTracks.geom} IS NULL THEN NULL ELSE ST_AsGeoJSON(${recordedTracks.geom}) END`,
        syncStatus: recordedTracks.syncStatus,
        createdAt: recordedTracks.createdAt,
        updatedAt: recordedTracks.updatedAt,
      })
      .from(recordedTracks)
      .where(and(...trackConditions))
      .orderBy(desc(recordedTracks.updatedAt))
      .limit(limit);

    return {
      syncedAt: new Date().toISOString(),
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
      tracks: trackRows.map((tr) => ({
        id: tr.id,
        userId: tr.userId,
        trailId: tr.trailId,
        title: tr.title,
        notes: tr.notes,
        difficulty: tr.difficulty,
        startedAt: tr.startedAt.toISOString(),
        endedAt: tr.endedAt ? tr.endedAt.toISOString() : null,
        movingTimeSeconds: tr.movingTimeSeconds,
        elapsedTimeSeconds: tr.elapsedTimeSeconds,
        totalDistanceKm: tr.totalDistanceKm,
        elevationGainM: tr.elevationGainM,
        elevationLossM: tr.elevationLossM,
        maxAltitudeM: tr.maxAltitudeM,
        minAltitudeM: tr.minAltitudeM,
        geom: tr.geomJson ? parseGeoJsonLineStringZM(tr.geomJson) : null,
        syncStatus: tr.syncStatus,
        createdAt: tr.createdAt.toISOString(),
        updatedAt: tr.updatedAt.toISOString(),
      })),
    };
  },
};
