import type {
  SyncBatchItem,
  SyncBatchItemResult,
  SyncBatchRequest,
  SyncBatchResponse,
} from "../../contracts";
import { analyzeLineStringMetrics } from "../../shared/geo/metrics";
import {
  syncRepository,
  type SyncDeltaPullResult,
  type SyncRepository,
} from "./sync.repository";
import {
  syncSafetyPayloadSchema,
  syncTrackPayloadSchema,
  syncWaypointPhotoPayloadSchema,
  type SyncPullQuery,
} from "./sync.validator";

export function createSyncService(repo: SyncRepository = syncRepository) {
  async function processSingleItem(
    item: SyncBatchItem,
    userId: string,
    deviceId: string,
  ): Promise<SyncBatchItemResult> {
    const existingEvent = await repo.findEventByClientId(item.clientEventId);
    if (existingEvent) {
      return {
        clientEventId: item.clientEventId,
        entityId: item.entityId,
        status: "duplicate",
        serverId: existingEvent.serverId,
        errorCode: null,
        errorMessage: null,
      };
    }

    const finalize = async (
      result: SyncBatchItemResult,
    ): Promise<SyncBatchItemResult> => {
      await repo.recordEvent({
        clientEventId: item.clientEventId,
        userId,
        deviceId,
        entityType: item.entityType,
        entityId: item.entityId,
        operation: item.operation,
        status: result.status,
        serverId: result.serverId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
      return result;
    };

    if (item.entityType === "recorded_track") {
      const existing = await repo.findTrackOwnerAndUpdatedAt(item.entityId);
      if (existing && existing.userId !== userId) {
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "conflict",
          serverId: item.entityId,
          errorCode: "OWNERSHIP_CONFLICT",
          errorMessage: "Recorded track belongs to a different user",
        });
      }

      if (item.operation === "delete") {
        await repo.deleteTrack(item.entityId);
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "accepted",
          serverId: item.entityId,
          errorCode: null,
          errorMessage: null,
        });
      }

      const clientUpdatedAt = new Date(item.clientUpdatedAt);
      if (
        item.operation === "update" &&
        existing &&
        existing.updatedAt.getTime() > clientUpdatedAt.getTime()
      ) {
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "conflict",
          serverId: item.entityId,
          errorCode: "STALE_UPDATE",
          errorMessage: "Server version is newer than clientUpdatedAt",
        });
      }

      const parsed = syncTrackPayloadSchema.safeParse(item.payload);
      if (!parsed.success) {
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "rejected",
          serverId: null,
          errorCode: "INVALID_PAYLOAD",
          errorMessage: "Invalid recorded_track sync payload",
        });
      }

      const trackData =
        "track" in parsed.data ? parsed.data.track : parsed.data;
      const metrics = trackData.geom
        ? analyzeLineStringMetrics(trackData.geom)
        : null;

      const saved = await repo.upsertTrack({
        id: item.entityId,
        userId,
        trailId: trackData.trailId ?? null,
        title: trackData.title,
        notes: trackData.notes ?? null,
        difficulty: trackData.difficulty ?? null,
        region: parsed.data.region,
        startedAt: new Date(trackData.startedAt),
        endedAt: trackData.endedAt ? new Date(trackData.endedAt) : null,
        movingTimeSeconds: trackData.movingTimeSeconds,
        elapsedTimeSeconds: trackData.elapsedTimeSeconds,
        totalDistanceKm:
          trackData.totalDistanceKm || metrics?.totalDistanceKm || 0,
        elevationGainM:
          trackData.elevationGainM || metrics?.elevationGainM || 0,
        elevationLossM:
          trackData.elevationLossM || metrics?.elevationLossM || 0,
        maxAltitudeM: trackData.maxAltitudeM ?? metrics?.maxAltitudeM ?? null,
        minAltitudeM: trackData.minAltitudeM ?? metrics?.minAltitudeM ?? null,
        geom: trackData.geom ?? null,
        submitForCommunityReview: parsed.data.submitForCommunityReview,
      });

      return finalize({
        clientEventId: item.clientEventId,
        entityId: item.entityId,
        status: "accepted",
        serverId: saved.id,
        errorCode: null,
        errorMessage: null,
      });
    }

    if (item.entityType === "safety_report") {
      const existing = await repo.findSafetyReportOwnerAndUpdatedAt(
        item.entityId,
      );
      if (existing && existing.userId !== userId) {
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "conflict",
          serverId: item.entityId,
          errorCode: "OWNERSHIP_CONFLICT",
          errorMessage: "Safety report belongs to a different user",
        });
      }

      if (item.operation === "delete") {
        await repo.deleteSafetyReport(item.entityId);
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "accepted",
          serverId: item.entityId,
          errorCode: null,
          errorMessage: null,
        });
      }

      const parsed = syncSafetyPayloadSchema.safeParse(item.payload);
      if (!parsed.success) {
        return finalize({
          clientEventId: item.clientEventId,
          entityId: item.entityId,
          status: "rejected",
          serverId: null,
          errorCode: "INVALID_PAYLOAD",
          errorMessage: "Invalid safety_report sync payload",
        });
      }

      const longitude =
        parsed.data.geom?.coordinates[0] ?? parsed.data.longitude!;
      const latitude =
        parsed.data.geom?.coordinates[1] ?? parsed.data.latitude!;

      const saved = await repo.upsertSafetyReport({
        id: item.entityId,
        trailId: parsed.data.trailId ?? null,
        userId,
        hazardType: parsed.data.hazardType,
        severity: parsed.data.severity,
        description: parsed.data.description,
        latitude,
        longitude,
        altitudeM: parsed.data.altitudeM ?? null,
        photoUrls: parsed.data.photoUrls,
      });

      return finalize({
        clientEventId: item.clientEventId,
        entityId: item.entityId,
        status: "accepted",
        serverId: saved.id,
        errorCode: null,
        errorMessage: null,
      });
    }

    // waypoint_photo
    const parsedPhoto = syncWaypointPhotoPayloadSchema.safeParse(item.payload);
    if (!parsedPhoto.success) {
      return finalize({
        clientEventId: item.clientEventId,
        entityId: item.entityId,
        status: "rejected",
        serverId: null,
        errorCode: "INVALID_PAYLOAD",
        errorMessage: "Invalid waypoint_photo sync payload",
      });
    }

    const attached = await repo.attachPhotoUrl(
      parsedPhoto.data.targetType,
      item.entityId,
      parsedPhoto.data.photoUrl,
    );

    if (!attached) {
      return finalize({
        clientEventId: item.clientEventId,
        entityId: item.entityId,
        status: "rejected",
        serverId: null,
        errorCode: "TARGET_NOT_FOUND",
        errorMessage: `Target ${parsedPhoto.data.targetType} not found`,
      });
    }

    return finalize({
      clientEventId: item.clientEventId,
      entityId: item.entityId,
      status: "accepted",
      serverId: item.entityId,
      errorCode: null,
      errorMessage: null,
    });
  }

  return {
    async processBatch(
      request: SyncBatchRequest,
      userId: string,
    ): Promise<SyncBatchResponse> {
      const results: SyncBatchItemResult[] = [];
      for (const item of request.items) {
        results.push(await processSingleItem(item, userId, request.deviceId));
      }

      return {
        syncedAt: new Date().toISOString(),
        results,
      };
    },

    async pullDelta(
      query: SyncPullQuery,
      userId: string,
    ): Promise<SyncDeltaPullResult> {
      return repo.pullDelta({
        userId,
        since: query.since ? new Date(query.since) : undefined,
        packRegionId: query.packRegionId,
        limit: query.limit,
      });
    },
  };
}

export const syncService = createSyncService();
