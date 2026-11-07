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
import { idParamSchema, transactionListQuerySchema, voidTransactionSchema } from "./schemas.js";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

const meta = (req: { ip?: string; get: (h: string) => string | undefined }) => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

transactionsRouter.get(
  "/",
  validateQuery(transactionListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await service.listTransactions(req.user!, validatedQuery<typeof transactionListQuerySchema._output>(req)));
  }),
);

transactionsRouter.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.getTransaction(req.user!, validatedParams<{ id: string }>(req).id));
  }),
);

transactionsRouter.post(
  "/:id/void",
  validateParams(idParamSchema),
  validateBody(voidTransactionSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await service.voidTransaction(
        req.user!,
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ reason: string }>(req).reason,
        meta(req),
      ),
    );
  }),
);
