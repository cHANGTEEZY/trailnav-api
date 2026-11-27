import type { UserRole } from "../../db/schema/auth";
import {
  gpxTrackToLineStringZM,
  parseGpxXml,
  serializeToGpxXml,
} from "../../shared/geo/gpx";
import {
  analyzeLineStringMetrics,
  type LineStringMetrics,
} from "../../shared/geo/metrics";
import type { PaginationMeta } from "../../shared/http/response";
import {
  tracksRepository,
  type TrackRecord,
  type TracksRepository,
} from "./tracks.repository";
import type {
  CreateTrackBody,
  ImportGpxBody,
  ListTracksQuery,
} from "./tracks.validator";

export class TrackAccessDeniedError extends Error {
  constructor() {
    super("You do not have permission to access this recorded track");
    this.name = "TrackAccessDeniedError";
  }
}

export class TrackGeometryMissingError extends Error {
  constructor() {
    super("Track does not contain recorded geometry to export");
    this.name = "TrackGeometryMissingError";
  }
}

export function createTracksService(repo: TracksRepository = tracksRepository) {
  function assertAccess(track: TrackRecord, userId: string, role: UserRole) {
    if (track.userId !== userId && role !== "admin" && role !== "moderator") {
      throw new TrackAccessDeniedError();
    }
  }

  return {
    async listUserTracks(
      userId: string,
      query: ListTracksQuery,
    ): Promise<{ items: TrackRecord[]; meta: PaginationMeta }> {
      const { items, total } = await repo.listByUser(
        userId,
        query.limit,
        query.offset,
      );
      return {
        items,
        meta: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + items.length < total,
        },
      };
    },

    async getTrackById(
      trackId: string,
      userId: string,
      role: UserRole,
    ): Promise<TrackRecord | null> {
      const track = await repo.findById(trackId);
      if (!track) return null;
      assertAccess(track, userId, role);
      return track;
    },

    async saveTrack(
      input: CreateTrackBody,
      userId: string,
    ): Promise<{ track: TrackRecord; analysis: LineStringMetrics | null }> {
      const analysis = input.geom ? analyzeLineStringMetrics(input.geom) : null;
      const id = input.id ?? `trk-${crypto.randomUUID()}`;

      const track = await repo.upsert({
        id,
        userId,
        trailId: input.trailId,
        title: input.title,
        notes: input.notes,
        difficulty: input.difficulty,
        region: input.region,
        startedAt: new Date(input.startedAt),
        endedAt: input.endedAt ? new Date(input.endedAt) : null,
        movingTimeSeconds: input.movingTimeSeconds,
        elapsedTimeSeconds: input.elapsedTimeSeconds,
        totalDistanceKm: input.totalDistanceKm ?? analysis?.totalDistanceKm ?? 0,
        elevationGainM: input.elevationGainM ?? analysis?.elevationGainM ?? 0,
        elevationLossM: input.elevationLossM ?? analysis?.elevationLossM ?? 0,
        maxAltitudeM: input.maxAltitudeM ?? analysis?.maxAltitudeM ?? null,
        minAltitudeM: input.minAltitudeM ?? analysis?.minAltitudeM ?? null,
        geom: input.geom,
        submitForCommunityReview: input.submitForCommunityReview,
      });

      return { track, analysis };
    },

    async importGpx(
      input: ImportGpxBody,
      userId: string,
    ): Promise<{ track: TrackRecord; analysis: LineStringMetrics }> {
      const gpx = parseGpxXml(input.gpxXml);
      const geom = gpxTrackToLineStringZM(gpx);
      const analysis = analyzeLineStringMetrics(geom);

      const firstTime = gpx.points.find((p) => p.time)?.time;
      const lastTime = [...gpx.points].reverse().find((p) => p.time)?.time;
      const startedAt = firstTime ? new Date(firstTime) : new Date();
      const endedAt = lastTime ? new Date(lastTime) : null;
      const elapsedTimeSeconds =
        endedAt && endedAt.getTime() >= startedAt.getTime()
          ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
          : 0;

      const track = await repo.upsert({
        id: `trk-${crypto.randomUUID()}`,
        userId,
        trailId: input.trailId,
        title: input.title ?? gpx.name,
        notes: input.notes ?? gpx.description,
        difficulty: input.difficulty,
        region: input.region,
        startedAt,
        endedAt,
        movingTimeSeconds: elapsedTimeSeconds,
        elapsedTimeSeconds,
        totalDistanceKm: analysis.totalDistanceKm,
        elevationGainM: analysis.elevationGainM,
        elevationLossM: analysis.elevationLossM,
        maxAltitudeM: analysis.maxAltitudeM,
        minAltitudeM: analysis.minAltitudeM,
        geom,
        submitForCommunityReview: input.submitForCommunityReview,
      });

      return { track, analysis };
    },

    async exportTrackGpx(
      trackId: string,
      userId: string,
      role: UserRole,
    ): Promise<{ filename: string; xml: string } | null> {
      const track = await this.getTrackById(trackId, userId, role);
      if (!track) return null;
      if (!track.geom) {
        throw new TrackGeometryMissingError();
      }

      const xml = serializeToGpxXml({
        name: track.title,
        description: track.notes,
        line: track.geom,
        startedAtIso: track.startedAt,
      });

      const safeName =
        track.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || track.id;

      return {
        filename: `${safeName}.gpx`,
        xml,
      };
    },

    async deleteTrack(
      trackId: string,
      userId: string,
      role: UserRole,
    ): Promise<boolean> {
      const track = await repo.findById(trackId);
      if (!track) return false;
      assertAccess(track, userId, role);
      return repo.remove(trackId);
    },
  };
}

export const tracksService = createTracksService();
