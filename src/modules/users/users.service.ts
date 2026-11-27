import type { UserRole } from "../../db/schema/auth";
import { usersRepository } from "./users.repository";
import type { PublicUser } from "./users.types";

function toPublicUser(record: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
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

export const usersService = {
  async getProfile(userId: string) {
    const record = await usersRepository.findById(userId);
    if (!record) return null;
    return toPublicUser(record);
  },
};
