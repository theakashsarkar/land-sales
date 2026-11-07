import { Router } from "express";
import { z } from "zod";
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
import * as usersService from "./service.js";
import {
  createUserSchema,
  updatePasswordSchema,
  updateStatusSchema,
  updateUserSchema,
  userListQuerySchema,
} from "./schemas.js";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireSuperAdmin);

const idParams = z.object({ id: z.string().min(1) });

usersRouter.post(
  "/",
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.createUser(validatedBody<typeof createUserSchema._output>(req), req.user!.id, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(201).json(user);
  }),
);

usersRouter.get(
  "/dropdown",
  asyncHandler(async (_req, res) => {
    res.json(await usersService.userDropdown());
  }),
);

usersRouter.get(
  "/",
  validateQuery(userListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await usersService.listUsers(validatedQuery<typeof userListQuerySchema._output>(req)));
  }),
);

usersRouter.get(
  "/:id",
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    res.json(await usersService.getUser(validatedParams<{ id: string }>(req).id));
  }),
);

usersRouter.patch(
  "/:id",
  validateParams(idParams),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await usersService.updateUser(
        validatedParams<{ id: string }>(req).id,
        validatedBody<typeof updateUserSchema._output>(req),
        req.user!.id,
        { ip: req.ip, userAgent: req.get("user-agent") },
      ),
    );
  }),
);

usersRouter.patch(
  "/:id/status",
  validateParams(idParams),
  validateBody(updateStatusSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await usersService.updateStatus(
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ isActive: boolean }>(req).isActive,
        req.user!.id,
        { ip: req.ip, userAgent: req.get("user-agent") },
      ),
    );
  }),
);

usersRouter.patch(
  "/:id/password",
  validateParams(idParams),
  validateBody(updatePasswordSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await usersService.updatePassword(
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ password: string }>(req).password,
        req.user!.id,
        { ip: req.ip, userAgent: req.get("user-agent") },
      ),
    );
  }),
);
