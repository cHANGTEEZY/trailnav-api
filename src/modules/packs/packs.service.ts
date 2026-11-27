import type { PackCatalog, RegionalPackManifest } from "../../contracts";
import {
  packsRepository,
  type PacksRepository,
  type RegionalPackBundle,
} from "./packs.repository";
import type { UpsertPackBody } from "./packs.validator";

export function createPacksService(repo: PacksRepository = packsRepository) {
  return {
    async getCatalog(): Promise<PackCatalog> {
      const packs = await repo.listPublished();
      const latestVersion = packs[0]?.version ?? "2026.10.1";
      return {
        version: latestVersion,
        generatedAt: new Date().toISOString(),
        packs,
      };
    },

    async getPackById(regionId: string): Promise<RegionalPackManifest | null> {
      return repo.findById(regionId);
    },

    async getRegionBundle(regionId: string): Promise<RegionalPackBundle | null> {
      return repo.getBundle(regionId);
    },

    async publishPack(
      regionId: string,
      input: UpsertPackBody,
    ): Promise<RegionalPackManifest> {
      return repo.upsert(regionId, input);
    },
  };
}

export const packsService = createPacksService();
