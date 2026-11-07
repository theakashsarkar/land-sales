import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{2,20}$/, "Code must be 2-20 characters (letters, numbers, dash, underscore)");

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(160),
    code: codeSchema,
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(255).optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    code: codeSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    location: z.string().trim().max(255).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const updateProjectStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const assignUsersSchema = z
  .object({ userIds: z.array(z.string().min(1)).min(1, "At least one user id is required").max(500) })
  .strict();

export const idParamSchema = z.object({ id: z.string().min(1) });
export const projectUserParamsSchema = z.object({ id: z.string().min(1), userId: z.string().min(1) });
