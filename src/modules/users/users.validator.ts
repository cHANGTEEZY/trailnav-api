import { z } from "zod";
import { USER_ROLES } from "../../db/schema/auth";

export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.enum(USER_ROLES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
