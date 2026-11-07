import { z } from "zod";

export const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  projectId: z.string().optional(),
  format: z.enum(["json", "pdf", "xlsx"]).default("json"),
  // transactions report extras
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  method: z.enum(["CASH", "BANK", "CHEQUE", "ONLINE", "OTHER"]).optional(),
  status: z.enum(["VALID", "VOID"]).optional(),
  createdById: z.string().optional(),
  search: z.string().trim().max(120).optional(),
});
