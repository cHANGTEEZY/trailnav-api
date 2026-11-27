import { desc, eq, sql } from "drizzle-orm";
import type {
  GeoJsonLineStringZM,
  RecordedTrack,
  TrailDifficulty,
} from "../../contracts";
import { db } from "../../db";
import {
  computeBoundingBox,
  parseGeoJsonLineStringZM,
  stAsGeoJson,
} from "../../db/postgis";
import { recordedTracks, trails } from "../../db/schema";
import { slugifyTitle } from "../trails/trails.service";

export type TrackRecord = RecordedTrack & {
  submittedForReview: boolean;
  promotedTrailId: string | null;
};

export type UpsertTrackInput = {
  id: string;
  userId: string;
  trailId: string | null;
  title: string;
  notes: string | null;
  difficulty: TrailDifficulty | null;
  region: string;
  startedAt: Date;
  endedAt: Date | null;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number | null;
  minAltitudeM: number | null;
  geom: GeoJsonLineStringZM | null;
  submitForCommunityReview: boolean;
};

export interface TracksRepository {
  listByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: TrackRecord[]; total: number }>;
  findById(id: string): Promise<TrackRecord | null>;
  upsert(input: UpsertTrackInput): Promise<TrackRecord>;
  remove(id: string): Promise<boolean>;
}

function mapTrackRow(row: {
  id: string;
  userId: string;
  trailId: string | null;
  title: string;
  notes: string | null;
  difficulty: TrailDifficulty | null;
  startedAt: Date;
  endedAt: Date | null;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number | null;
  minAltitudeM: number | null;
  geomJson: string | null;
  syncStatus: "synced" | "local_only" | "pending";
  submittedForReview: boolean;
  promotedTrailId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TrackRecord {
  return {
    id: row.id,
    userId: row.userId,
    trailId: row.trailId,
    title: row.title,
    notes: row.notes,
    difficulty: row.difficulty,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    movingTimeSeconds: row.movingTimeSeconds,
    elapsedTimeSeconds: row.elapsedTimeSeconds,
    totalDistanceKm: row.totalDistanceKm,
    elevationGainM: row.elevationGainM,
    elevationLossM: row.elevationLossM,
    maxAltitudeM: row.maxAltitudeM,
    minAltitudeM: row.minAltitudeM,
    geom: row.geomJson ? parseGeoJsonLineStringZM(row.geomJson) : null,
    syncStatus: row.syncStatus,
    submittedForReview: row.submittedForReview,
    promotedTrailId: row.promotedTrailId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const tracksRepository: TracksRepository = {
  async listByUser(userId, limit, offset) {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(recordedTracks)
      .where(eq(recordedTracks.userId, userId));

    const rows = await db
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
        submittedForReview: recordedTracks.submittedForReview,
        promotedTrailId: recordedTracks.promotedTrailId,
        createdAt: recordedTracks.createdAt,
        updatedAt: recordedTracks.updatedAt,
      })
      .from(recordedTracks)
      .where(eq(recordedTracks.userId, userId))
      .orderBy(desc(recordedTracks.startedAt))
      .limit(limit)
      .offset(offset);

    return { items: rows.map(mapTrackRow), total };
  },

  async findById(id) {
    const [row] = await db
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
        geomJson: sql<string | null>`CASE WHEN ${recordedTracks.geom} IS NULL THEN NULL ELSE ${stAsGeoJson(recordedTracks.geom)} END`,
        syncStatus: recordedTracks.syncStatus,
        submittedForReview: recordedTracks.submittedForReview,
        promotedTrailId: recordedTracks.promotedTrailId,
        createdAt: recordedTracks.createdAt,
        updatedAt: recordedTracks.updatedAt,
      })
      .from(recordedTracks)
      .where(eq(recordedTracks.id, id))
      .limit(1);

    return row ? mapTrackRow(row) : null;
  },

  async upsert(input) {
    const now = new Date();

    await db.transaction(async (tx) => {
      let promotedTrailId: string | null = null;

      if (input.submitForCommunityReview && input.geom) {
        promotedTrailId = `trail-community-${input.id}`;
        const slug = `${slugifyTitle(input.title) || "community-trail"}-${input.id.slice(-6)}`;
        const bbox = computeBoundingBox(input.geom.coordinates);

        await tx
          .insert(trails)
          .values({
            id: promotedTrailId,
            title: input.title,
            slug,
            region: input.region,
            description: input.notes,
            difficulty: input.difficulty ?? "moderate",
            distanceKm: input.totalDistanceKm,
            elevationGainM: input.elevationGainM,
            elevationLossM: input.elevationLossM,
            minAltitudeM: input.minAltitudeM,
            maxAltitudeM: input.maxAltitudeM ?? 0,
            bbox,
            geom: input.geom,
            status: "community_pending",
            packRegionId: null,
            createdBy: input.userId,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: trails.id });
      }

      await tx
        .insert(recordedTracks)
        .values({
          id: input.id,
          userId: input.userId,
          trailId: input.trailId,
          title: input.title,
          notes: input.notes,
          difficulty: input.difficulty,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          movingTimeSeconds: input.movingTimeSeconds,
          elapsedTimeSeconds: input.elapsedTimeSeconds,
          totalDistanceKm: input.totalDistanceKm,
          elevationGainM: input.elevationGainM,
          elevationLossM: input.elevationLossM,
          maxAltitudeM: input.maxAltitudeM,
          minAltitudeM: input.minAltitudeM,
          geom: input.geom,
          syncStatus: "synced",
          submittedForReview: input.submitForCommunityReview,
          promotedTrailId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: recordedTracks.id,
          set: {
            title: input.title,
            notes: input.notes,
            difficulty: input.difficulty,
            endedAt: input.endedAt,
            movingTimeSeconds: input.movingTimeSeconds,
            elapsedTimeSeconds: input.elapsedTimeSeconds,
            totalDistanceKm: input.totalDistanceKm,
            elevationGainM: input.elevationGainM,
            elevationLossM: input.elevationLossM,
            maxAltitudeM: input.maxAltitudeM,
            minAltitudeM: input.minAltitudeM,
            geom: input.geom,
            syncStatus: "synced",
            submittedForReview: input.submitForCommunityReview,
            promotedTrailId: promotedTrailId ?? undefined,
            updatedAt: now,
          },
        });
    });

    const saved = await this.findById(input.id);
    if (!saved) {
      throw new Error("Upserted track could not be loaded");
    }
    return saved;
  },

  async remove(id) {
    const deleted = await db
      .delete(recordedTracks)
      .where(eq(recordedTracks.id, id))
      .returning({ id: recordedTracks.id });
    return deleted.length > 0;
  },
};
