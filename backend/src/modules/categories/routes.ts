import { Router } from "express";
import { requireAuth, requireSuperAdmin } from "../../middleware/auth.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../../middleware/validate.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as categoriesService from "./service.js";
import {
  createCategorySchema,
  idParamSchema,
  updateCategorySchema,
  updateCategoryStatusSchema,
  categoryListQuerySchema,
} from "./schemas.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const meta = (req: { ip?: string; get: (h: string) => string | undefined }) => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

categoriesRouter.get(
  "/dropdown",
  asyncHandler(async (_req, res) => {
    res.json(await categoriesService.categoryDropdown());
  }),
);

categoriesRouter.get(
  "/",
  validateQuery(categoryListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await categoriesService.listCategories(validatedQuery<typeof categoryListQuerySchema._output>(req)));
  }),
);

categoriesRouter.post(
  "/",
  requireSuperAdmin,
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await categoriesService.createCategory(validatedBody<typeof createCategorySchema._output>(req), req.user!.id, meta(req)),
    );
  }),
);

categoriesRouter.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await categoriesService.getCategory(validatedParams<{ id: string }>(req).id));
  }),
);

categoriesRouter.patch(
  "/:id",
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    res.json(
      await categoriesService.updateCategory(
        validatedParams<{ id: string }>(req).id,
        validatedBody<typeof updateCategorySchema._output>(req),
        req.user!.id,
        meta(req),
      ),
    );
  }),
);

categoriesRouter.patch(
  "/:id/status",
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(updateCategoryStatusSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await categoriesService.updateCategoryStatus(
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ isActive: boolean }>(req).isActive,
        req.user!.id,
        meta(req),
      ),
    );
  }),
);
