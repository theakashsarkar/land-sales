import { z } from "zod";

export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Amount must be a positive number (max 4 decimal places)")
  .or(z.number().positive().finite());

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const createFinancialRecordSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    partyName: z.string().trim().min(1, "Party name is required").max(160),
    partyPhone: z.string().trim().max(40).optional(),
    description: z.string().trim().max(2000).optional(),
    projectId: z.string().min(1, "Project is required"),
    categoryId: z.string().min(1, "Category is required"),
    totalAmount: moneySchema,
  })
  .strict();

export const updateFinancialRecordSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    partyName: z.string().trim().min(1).max(160).optional(),
    partyPhone: z.string().trim().max(40).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    categoryId: z.string().min(1).optional(),
    totalAmount: moneySchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const updateRecordStatusSchema = z
  .object({ status: z.enum(["ACTIVE", "CANCELLED"]) })
  .strict();

export const recordListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
  projectId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  sortBy: z.enum(["createdAt", "totalAmount", "code"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const paymentSchema = z
  .object({
    amount: moneySchema,
    paidAt: z.coerce.date().optional(),
    method: z.enum(["CASH", "BANK", "CHEQUE", "ONLINE", "OTHER"]).default("CASH"),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().min(1) });
