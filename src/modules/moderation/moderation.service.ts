import type { SafetyReport, Trail } from "../../contracts";
import { computeBoundingBox } from "../../db/postgis";
import {
  analyzeLineStringMetrics,
  type LineStringMetrics,
} from "../../shared/geo/metrics";
import {
  moderationRepository,
  type ModerationRepository,
} from "./moderation.repository";
import type {
  ReviewTrailBody,
  TriageHazardBody,
} from "./moderation.validator";

export type PendingTrailQueueItem = {
  trail: Trail;
  diagnostics: LineStringMetrics;
};

export type ModerationQueue = {
  pendingTrails: PendingTrailQueueItem[];
  unresolvedHazards: SafetyReport[];
  summary: {
    pendingTrailCount: number;
    flaggedSpikeTrailCount: number;
    unresolvedHazardCount: number;
  };
};

export type TrailReviewResult =
  | {
      decision: "approve_verified" | "approve_community";
      trail: Trail;
      reviewNotes: string | null;
    }
  | {
      decision: "reject";
      trailId: string;
      deleted: boolean;
      reviewNotes: string | null;
    };

export function createModerationService(
  repo: ModerationRepository = moderationRepository,
) {
  return {
    async getQueue(limit: number): Promise<ModerationQueue> {
      const [pending, unresolvedHazards] = await Promise.all([
        repo.listPendingTrails(limit),
        repo.listUnresolvedHazards(limit),
      ]);

      const pendingTrails: PendingTrailQueueItem[] = pending.map((trail) => ({
        trail,
        diagnostics: analyzeLineStringMetrics(trail.geom),
      }));

      const flaggedSpikeTrailCount = pendingTrails.filter(
        (item) => item.diagnostics.elevationSpikes.length > 0,
      ).length;

      return {
        pendingTrails,
        unresolvedHazards,
        summary: {
          pendingTrailCount: pendingTrails.length,
          flaggedSpikeTrailCount,
          unresolvedHazardCount: unresolvedHazards.length,
        },
      };
    },

    async reviewTrail(
      trailId: string,
      input: ReviewTrailBody,
      reviewerId: string,
    ): Promise<TrailReviewResult | null> {
      const existing = await repo.findTrailById(trailId);
      if (!existing) return null;

      if (input.decision === "reject") {
        const deleted = await repo.deleteTrail(trailId);
        return {
          decision: "reject",
          trailId,
          deleted,
          reviewNotes: input.reviewNotes,
        };
      }

      const nextStatus =
        input.decision === "approve_verified"
          ? "verified"
          : "community_approved";

      const geomMetrics = input.geom
        ? analyzeLineStringMetrics(input.geom)
        : null;

      const updated = await repo.applyTrailReview(trailId, {
        status: nextStatus,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
        title: input.title,
        region: input.region,
        difficulty: input.difficulty,
        packRegionId: input.packRegionId,
        geom: input.geom,
        bbox: input.geom ? computeBoundingBox(input.geom.coordinates) : undefined,
        distanceKm: geomMetrics?.totalDistanceKm,
        elevationGainM: geomMetrics?.elevationGainM,
        elevationLossM: geomMetrics?.elevationLossM,
        minAltitudeM: geomMetrics?.minAltitudeM,
        maxAltitudeM: geomMetrics?.maxAltitudeM,
      });

      if (!updated) return null;

      return {
        decision: input.decision,
        trail: updated,
        reviewNotes: input.reviewNotes,
      };
    },

    async triageHazard(
      hazardId: string,
      input: TriageHazardBody,
      actorId: string,
    ): Promise<SafetyReport | null> {
      return repo.triageHazard(hazardId, {
        severity: input.severity,
        isResolved: input.isResolved,
        description: input.description,
        actorId,
      });
    },
  };
}

export const moderationService = createModerationService();
