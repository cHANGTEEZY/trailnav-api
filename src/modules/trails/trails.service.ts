import { computeBoundingBox } from "../../db/postgis";
import type { UserRole } from "../../db/schema/auth";
import type { PaginationMeta } from "../../shared/http/response";
import {
  trailsRepository,
  type TrailDetailRecord,
  type TrailsRepository,
} from "./trails.repository";
import type { CreateTrailBody, ListTrailsQuery } from "./trails.validator";

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export class TrailSlugConflictError extends Error {
  constructor(slug: string) {
    super(`A trail with slug "${slug}" already exists`);
    this.name = "TrailSlugConflictError";
  }
}

export function createTrailsService(repo: TrailsRepository = trailsRepository) {
  return {
    async listTrails(query: ListTrailsQuery): Promise<{
      items: Awaited<ReturnType<TrailsRepository["list"]>>["items"];
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

    async getTrailByIdOrSlug(idOrSlug: string): Promise<TrailDetailRecord | null> {
      return repo.findByIdOrSlug(idOrSlug);
    },

    async createTrail(
      input: CreateTrailBody,
      authorId: string,
      authorRole: UserRole,
    ): Promise<TrailDetailRecord> {
      const baseSlug = input.slug ?? slugifyTitle(input.title);
      const slug = baseSlug.length >= 3 ? baseSlug : `trail-${crypto.randomUUID().slice(0, 8)}`;

      const existing = await repo.findBySlug(slug);
      if (existing) {
        throw new TrailSlugConflictError(slug);
      }

      const bbox = computeBoundingBox(input.geom.coordinates);
      const id = input.id ?? `trail-${crypto.randomUUID()}`;
      const status =
        authorRole === "admin" || authorRole === "moderator"
          ? "verified"
          : "community_pending";

      return repo.create({
        id,
        title: input.title,
        slug,
        region: input.region,
        description: input.description,
        difficulty: input.difficulty,
        distanceKm: input.distanceKm,
        elevationGainM: input.elevationGainM,
        elevationLossM: input.elevationLossM,
        minAltitudeM: input.minAltitudeM,
        maxAltitudeM: input.maxAltitudeM,
        bbox,
        geom: input.geom,
        status,
        packRegionId: input.packRegionId,
        createdBy: authorId,
        waypoints: input.waypoints,
      });
    },
  };
}

export const trailsService = createTrailsService();
