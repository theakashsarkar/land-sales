import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../../middleware/validate.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./service.js";
import {
  cancelInvoiceSchema,
  createInvoiceSchema,
  createReceiptSchema,
  idParamSchema,
  invoiceListQuerySchema,
} from "./schemas.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

const meta = (req: { ip?: string; get: (h: string) => string | undefined }) => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

invoicesRouter.post(
  "/receipts",
  validateBody(createReceiptSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createReceipt(req.user!, validatedBody<{ transactionId: string }>(req).transactionId, meta(req)));
  }),
);

invoicesRouter.post(
  "/",
  validateBody(createInvoiceSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createInvoice(req.user!, validatedBody<typeof createInvoiceSchema._output>(req), meta(req)));
  }),
);

invoicesRouter.get(
  "/",
  validateQuery(invoiceListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await service.listInvoices(req.user!, validatedQuery<typeof invoiceListQuerySchema._output>(req)));
  }),
);

invoicesRouter.get(
  "/:id/pdf",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { buffer, number } = await service.invoicePdf(req.user!, validatedParams<{ id: string }>(req).id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${number}.pdf"`);
    res.send(buffer);
  }),
);

invoicesRouter.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.getInvoice(req.user!, validatedParams<{ id: string }>(req).id));
  }),
);

invoicesRouter.post(
  "/:id/cancel",
  validateParams(idParamSchema),
  validateBody(cancelInvoiceSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await service.cancelInvoice(
        req.user!,
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ reason: string }>(req).reason,
        meta(req),
      ),
    );
  }),
);
