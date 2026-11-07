import { z } from "zod";

export const transactionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  projectId: z.string().optional(),
  financialRecordId: z.string().optional(),
  method: z.enum(["CASH", "BANK", "CHEQUE", "ONLINE", "OTHER"]).optional(),
  status: z.enum(["VALID", "VOID"]).optional(),
  createdById: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
});

export const voidTransactionSchema = z
  .object({
    reason: z.string().trim().min(3, "A void reason is required").max(500),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().min(1) });
