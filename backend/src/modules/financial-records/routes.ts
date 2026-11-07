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
  createFinancialRecordSchema,
  idParamSchema,
  paymentSchema,
  recordListQuerySchema,
  updateFinancialRecordSchema,
  updateRecordStatusSchema,
} from "./schemas.js";

export const financialRecordsRouter = Router();
financialRecordsRouter.use(requireAuth);

const meta = (req: { ip?: string; get: (h: string) => string | undefined }) => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

financialRecordsRouter.post(
  "/",
  validateBody(createFinancialRecordSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createRecord(req.user!, validatedBody<typeof createFinancialRecordSchema._output>(req), meta(req)));
  }),
);

financialRecordsRouter.get(
  "/",
  validateQuery(recordListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await service.listRecords(req.user!, validatedQuery<typeof recordListQuerySchema._output>(req)));
  }),
);

financialRecordsRouter.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.getRecord(req.user!, validatedParams<{ id: string }>(req).id));
  }),
);

financialRecordsRouter.patch(
  "/:id",
  validateParams(idParamSchema),
  validateBody(updateFinancialRecordSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.updateRecord(req.user!, validatedParams<{ id: string }>(req).id, validatedBody<typeof updateFinancialRecordSchema._output>(req), meta(req)));
  }),
);

financialRecordsRouter.patch(
  "/:id/status",
  validateParams(idParamSchema),
  validateBody(updateRecordStatusSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.updateRecordStatus(req.user!, validatedParams<{ id: string }>(req).id, validatedBody<{ status: "ACTIVE" | "CANCELLED" }>(req).status, meta(req)));
  }),
);

financialRecordsRouter.get(
  "/:id/history",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.recordHistory(req.user!, validatedParams<{ id: string }>(req).id));
  }),
);

financialRecordsRouter.post(
  "/:id/payments",
  validateParams(idParamSchema),
  validateBody(paymentSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.recordPayment(req.user!, validatedParams<{ id: string }>(req).id, validatedBody<typeof paymentSchema._output>(req), meta(req)));
  }),
);

financialRecordsRouter.get(
  "/:id/transactions",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.recordTransactions(req.user!, validatedParams<{ id: string }>(req).id, req.query as { page?: number; pageSize?: number }));
  }),
);
