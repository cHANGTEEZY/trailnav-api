import {
  waypointsRepository,
  type WaypointsRepository,
} from "./waypoints.repository";
import type {
  NearbyWaypointsQuery,
  UnifiedSearchQuery,
} from "./waypoints.validator";

export function createWaypointsService(
  repo: WaypointsRepository = waypointsRepository,
) {
  return {
    async findNearbyWaypoints(query: NearbyWaypointsQuery) {
      return repo.findNearby({
        lat: query.lat,
        lon: query.lon,
        radiusMeters: query.radiusKm * 1000,
        category: query.category,
        limit: query.limit,
      });
    },

    async search(query: UnifiedSearchQuery) {
      return repo.searchUnified(query);
    },
  };
}

export const waypointsService = createWaypointsService();
