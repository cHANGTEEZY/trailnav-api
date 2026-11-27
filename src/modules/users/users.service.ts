import {
  usersRepository,
  type TrekkerStats,
  type UserRecord,
  type UsersRepository,
} from "./users.repository";
import type { PublicUser } from "./users.types";
import type { UpdateProfileBody } from "./users.validator";

function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    emailVerified: record.emailVerified,
    image: record.image,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function createUsersService(repo: UsersRepository = usersRepository) {
  return {
    async getProfile(userId: string): Promise<PublicUser | null> {
      const record = await repo.findById(userId);
      if (!record) return null;
      return toPublicUser(record);
    },

    async updateProfile(
      userId: string,
      patch: UpdateProfileBody,
    ): Promise<PublicUser | null> {
      const updated = await repo.updateProfile(userId, patch);
      if (!updated) return null;
      return toPublicUser(updated);
    },

    async getStats(userId: string): Promise<TrekkerStats> {
      return repo.getStats(userId);
    },
  };
}

export const usersService = createUsersService();
