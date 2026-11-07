import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { diffFields, recordChanges, recordEvent } from "../../lib/history.js";
import { pageResult, parsePagination } from "../../lib/pagination.js";
import { accessibleProjectIds } from "../../lib/access.js";
import type { AuthUser } from "../../types.js";
import type { RequestMeta } from "../auth/service.js";

function conflictIfCodeTaken(err: unknown, message: string): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw AppError.conflict(message);
  }
}

export async function createProject(
  input: { name: string; code: string; description?: string; location?: string },
  actorId: string,
  meta: RequestMeta,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: input.name,
          code: input.code.toUpperCase(),
          description: input.description ?? null,
          location: input.location ?? null,
        },
      });
      await recordEvent(tx, {
        entityType: "Project",
        entityId: project.id,
        action: "CREATED",
        actorId,
        newValue: JSON.stringify({ name: project.name, code: project.code }),
      });
      await writeAudit(tx, {
        userId: actorId,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        metadata: { name: project.name, code: project.code },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return project;
    });
  } catch (err) {
    conflictIfCodeTaken(err, "A project with this code already exists");
    throw err;
  }
}

export async function listProjects(
  actor: AuthUser,
  query: { page?: number; pageSize?: number; search?: string; isActive?: boolean },
) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const scopeIds = await accessibleProjectIds(actor);
  const where: Prisma.ProjectWhereInput = {
    ...(scopeIds ? { id: { in: scopeIds } } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.project.count({ where }),
  ]);
  return pageResult(rows, total, page, pageSize);
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw AppError.notFound("Project");
  return project;
}

export async function updateProject(
  id: string,
  input: { name?: string; code?: string; description?: string | null; location?: string | null },
  actorId: string,
  meta: RequestMeta,
) {
  const before = await prisma.project.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Project");

  try {
    return await prisma.$transaction(async (tx) => {
      const after = await tx.project.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code.toUpperCase() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
        },
      });
      const changes = diffFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        ["name", "code", "description", "location"],
      );
      await recordChanges(tx, { entityType: "Project", entityId: id, action: "UPDATED", changes, actorId });
      await writeAudit(tx, {
        userId: actorId,
        action: "PROJECT_UPDATED",
        entityType: "Project",
        entityId: id,
        metadata: { changes },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return after;
    });
  } catch (err) {
    conflictIfCodeTaken(err, "A project with this code already exists");
    throw err;
  }
}

export async function updateProjectStatus(id: string, isActive: boolean, actorId: string, meta: RequestMeta) {
  const before = await prisma.project.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Project");
  return prisma.$transaction(async (tx) => {
    const after = await tx.project.update({ where: { id }, data: { isActive }, include: { users: true } });
    await recordEvent(tx, {
      entityType: "Project",
      entityId: id,
      action: "STATUS_CHANGED",
      field: "isActive",
      oldValue: before.isActive,
      newValue: isActive,
      actorId,
    });
    await writeAudit(tx, {
      userId: actorId,
      action: isActive ? "PROJECT_ACTIVATED" : "PROJECT_DEACTIVATED",
      entityType: "Project",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ...after, users: undefined };
  });
}

export async function projectDropdown(actor: AuthUser) {
  const scopeIds = await accessibleProjectIds(actor);
  const data = await prisma.project.findMany({
    where: { isActive: true, ...(scopeIds ? { id: { in: scopeIds } } : {}) },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return { data };
}

export async function listProjectUsers(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw AppError.notFound("Project");
  const grants = await prisma.projectUser.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
    orderBy: { assignedAt: "asc" },
  });
  return {
    data: grants.map((g) => ({
      ...g.user,
      assignedAt: g.assignedAt.toISOString(),
      assignedById: g.assignedById,
    })),
  };
}

async function assertUsersExist(userIds: string[]) {
  const found = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  if (found.length !== new Set(userIds).size) {
    throw AppError.badRequest("One or more user ids do not exist");
  }
}

export async function assignProjectUsers(
  projectId: string,
  userIds: string[],
  actorId: string,
  meta: RequestMeta,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw AppError.notFound("Project");
  await assertUsersExist(userIds);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.projectUser.findMany({
      where: { projectId, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((g) => g.userId));
    const fresh = userIds.filter((id) => !existingSet.has(id));
    if (fresh.length > 0) {
      await tx.projectUser.createMany({
        data: fresh.map((userId) => ({ projectId, userId, assignedById: actorId })),
      });
    }
    await writeAudit(tx, {
      userId: actorId,
      action: "PROJECT_USERS_ASSIGNED",
      entityType: "Project",
      entityId: projectId,
      metadata: { userIds },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await recordEvent(tx, {
      entityType: "Project",
      entityId: projectId,
      action: "USERS_ASSIGNED",
      actorId,
      newValue: JSON.stringify(userIds),
    });
  });
  return listProjectUsers(projectId);
}

export async function replaceProjectUsers(
  projectId: string,
  userIds: string[],
  actorId: string,
  meta: RequestMeta,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw AppError.notFound("Project");
  await assertUsersExist(userIds);

  await prisma.$transaction(async (tx) => {
    await tx.projectUser.deleteMany({ where: { projectId } });
    await tx.projectUser.createMany({
      data: userIds.map((userId) => ({ projectId, userId, assignedById: actorId })),
    });
    await writeAudit(tx, {
      userId: actorId,
      action: "PROJECT_USERS_REPLACED",
      entityType: "Project",
      entityId: projectId,
      metadata: { userIds },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await recordEvent(tx, {
      entityType: "Project",
      entityId: projectId,
      action: "USERS_REPLACED",
      actorId,
      newValue: JSON.stringify(userIds),
    });
  });
  return listProjectUsers(projectId);
}

export async function removeProjectUser(
  projectId: string,
  userId: string,
  actorId: string,
  meta: RequestMeta,
) {
  const grant = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!grant) throw AppError.notFound("Project assignment");
  await prisma.$transaction(async (tx) => {
    await tx.projectUser.delete({ where: { projectId_userId: { projectId, userId } } });
    await writeAudit(tx, {
      userId: actorId,
      action: "PROJECT_USER_REMOVED",
      entityType: "Project",
      entityId: projectId,
      metadata: { removedUserId: userId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await recordEvent(tx, {
      entityType: "Project",
      entityId: projectId,
      action: "USER_REMOVED",
      actorId,
      oldValue: userId,
    });
  });
  return { ok: true };
}
