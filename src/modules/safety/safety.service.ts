import type { SafetyReport } from "../../contracts";
import type { UserRole } from "../../db/schema/auth";
import type { PaginationMeta } from "../../shared/http/response";
import {
  safetyRepository,
  type SafetyRepository,
} from "./safety.repository";
import type {
  CreateSafetyReportBody,
  ListSafetyReportsQuery,
} from "./safety.validator";

export class SafetyReportAccessDeniedError extends Error {
  constructor() {
    super("Only the reporter or a moderator can update this hazard report");
    this.name = "SafetyReportAccessDeniedError";
  }
}

export function createSafetyService(repo: SafetyRepository = safetyRepository) {
  return {
    async listReports(query: ListSafetyReportsQuery): Promise<{
      items: SafetyReport[];
      meta: PaginationMeta;
    }> {
      const { items, total } = await repo.list(query);
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

    async createReport(
      input: CreateSafetyReportBody,
      userId: string,
    ): Promise<SafetyReport> {
      const id = input.id ?? `hazard-${crypto.randomUUID()}`;
      return repo.upsert({
        id,
        trailId: input.trailId,
        userId,
        hazardType: input.hazardType,
        severity: input.severity,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        altitudeM: input.altitudeM,
        photoUrls: input.photoUrls,
      });
    },

    async resolveReport(
      reportId: string,
      isResolved: boolean,
      actorId: string,
      actorRole: UserRole,
    ): Promise<SafetyReport | null> {
      const existing = await repo.findById(reportId);
      if (!existing) return null;

      if (
        existing.userId !== actorId &&
        actorRole !== "moderator" &&
        actorRole !== "admin"
      ) {
        throw new SafetyReportAccessDeniedError();
      }

      return repo.setResolved(reportId, isResolved, actorId);
    },
  };
}

export const safetyService = createSafetyService();
