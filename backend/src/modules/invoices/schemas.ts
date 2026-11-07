import { z } from "zod";

export const itemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required").max(300),
  quantity: z.coerce.number().positive("Quantity must be positive").default(1),
  unitPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a positive amount")
    .or(z.coerce.number().positive()),
});

export const createInvoiceSchema = z
  .object({
    financialRecordId: z.string().min(1, "Financial record is required"),
    items: z.array(itemSchema).min(1, "At least one line item is required").max(50),
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const createReceiptSchema = z
  .object({ transactionId: z.string().min(1, "Transaction is required") })
  .strict();

export const cancelInvoiceSchema = z
  .object({ reason: z.string().trim().min(3, "A cancellation reason is required").max(500) })
  .strict();

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  type: z.enum(["INVOICE", "RECEIPT"]).optional(),
  status: z.enum(["ISSUED", "CANCELLED"]).optional(),
  financialRecordId: z.string().optional(),
  projectId: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
