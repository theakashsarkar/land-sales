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
import * as projectsService from "./service.js";
import {
  assignUsersSchema,
  createProjectSchema,
  idParamSchema,
  projectListQuerySchema,
  projectUserParamsSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "./schemas.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const meta = (req: { ip?: string; get: (h: string) => string | undefined }) => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

// Any authenticated user may read the scoped list/dropdown; mutations are
// super-admin only. Reads are additionally scoped to the user's granted
// projects inside the service layer.
projectsRouter.get(
  "/dropdown",
  asyncHandler(async (req, res) => {
    res.json(await projectsService.projectDropdown(req.user!));
  }),
);

projectsRouter.get(
  "/",
  validateQuery(projectListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await projectsService.listProjects(req.user!, validatedQuery<typeof projectListQuerySchema._output>(req)));
  }),
);

projectsRouter.post(
  "/",
  requireSuperAdmin,
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await projectsService.createProject(validatedBody<typeof createProjectSchema._output>(req), req.user!.id, meta(req)),
    );
  }),
);

projectsRouter.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await projectsService.getProject(validatedParams<{ id: string }>(req).id));
  }),
);

projectsRouter.patch(
  "/:id",
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(updateProjectSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await projectsService.updateProject(
        validatedParams<{ id: string }>(req).id,
        validatedBody<typeof updateProjectSchema._output>(req),
        req.user!.id,
        meta(req),
      ),
    );
  }),
);

projectsRouter.patch(
  "/:id/status",
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(updateProjectStatusSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await projectsService.updateProjectStatus(
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ isActive: boolean }>(req).isActive,
        req.user!.id,
        meta(req),
      ),
    );
  }),
);

projectsRouter.get(
  "/:id/users",
  requireSuperAdmin,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json(await projectsService.listProjectUsers(validatedParams<{ id: string }>(req).id));
  }),
);

projectsRouter.post(
  "/:id/users",
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(assignUsersSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await projectsService.assignProjectUsers(
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ userIds: string[] }>(req).userIds,
        req.user!.id,
        meta(req),
      ),
    );
  }),
);

projectsRouter.put(
  "/:id/users",
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(assignUsersSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await projectsService.replaceProjectUsers(
        validatedParams<{ id: string }>(req).id,
        validatedBody<{ userIds: string[] }>(req).userIds,
        req.user!.id,
        meta(req),
      ),
    );
  }),
);

projectsRouter.delete(
  "/:id/users/:userId",
  requireSuperAdmin,
  validateParams(projectUserParamsSchema),
  asyncHandler(async (req, res) => {
    const { id, userId } = validatedParams<{ id: string; userId: string }>(req);
    res.json(await projectsService.removeProjectUser(id, userId, req.user!.id, meta(req)));
  }),
);
