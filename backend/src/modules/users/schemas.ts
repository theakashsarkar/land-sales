import { z } from "zod";
import { ROLES } from "../../types.js";

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("A valid email is required").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    role: z.enum(ROLES).default("USER"),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    role: z.enum(ROLES).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const updateStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const updatePasswordSchema = z
  .object({ password: z.string().min(8, "Password must be at least 8 characters").max(128) })
  .strict();

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
