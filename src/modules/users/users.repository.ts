import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  recordedTracks,
  safetyReports,
  trails,
  user,
  type UserRole,
} from "../../db/schema";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type TrekkerStats = {
  tracksRecorded: number;
  totalDistanceKm: number;
  totalElevationGainM: number;
  maxAltitudeReachedM: number | null;
  hazardsReported: number;
  communityTrailsSubmitted: number;
};

export interface UsersRepository {
  findById(id: string): Promise<UserRecord | null>;
  updateProfile(
    id: string,
    patch: { name?: string; image?: string | null },
  ): Promise<UserRecord | null>;
  getStats(userId: string): Promise<TrekkerStats>;
}

export const usersRepository: UsersRepository = {
  async findById(id) {
    const [record] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    return record ?? null;
  },

  async updateProfile(id, patch) {
    const [updated] = await db
      .update(user)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.image !== undefined ? { image: patch.image } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning();

    return updated ?? null;
  },

  async getStats(userId) {
    const [trackAgg] = await db
      .select({
        tracksRecorded: sql<number>`count(*)::int`,
        totalDistanceKm: sql<number>`coalesce(sum(${recordedTracks.totalDistanceKm}), 0)::double precision`,
        totalElevationGainM: sql<number>`coalesce(sum(${recordedTracks.elevationGainM}), 0)::int`,
        maxAltitudeReachedM: sql<number | null>`max(${recordedTracks.maxAltitudeM})::int`,
      })
      .from(recordedTracks)
      .where(eq(recordedTracks.userId, userId));

    const [hazardAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(safetyReports)
      .where(eq(safetyReports.userId, userId));

    const [trailAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trails)
      .where(eq(trails.createdBy, userId));

    return {
      tracksRecorded: trackAgg?.tracksRecorded ?? 0,
      totalDistanceKm:
        Math.round(Number(trackAgg?.totalDistanceKm ?? 0) * 100) / 100,
      totalElevationGainM: trackAgg?.totalElevationGainM ?? 0,
      maxAltitudeReachedM: trackAgg?.maxAltitudeReachedM ?? null,
      hazardsReported: hazardAgg?.count ?? 0,
      communityTrailsSubmitted: trailAgg?.count ?? 0,
    };
  },
};
