import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("A valid email is required").max(255),
    password: z.string().min(1, "Password is required").max(255),
  })
  .strict();

export const refreshSchema = z.object({ refreshToken: z.string().optional() }).strict();
