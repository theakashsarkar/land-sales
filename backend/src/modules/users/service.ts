import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { diffFields, recordChanges, recordEvent } from "../../lib/history.js";
import { parsePagination, pageResult } from "../../lib/pagination.js";
import { env } from "../../config/env.js";
import type { RequestMeta } from "../auth/service.js";

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

function conflictIfEmailTaken(err: unknown): never | void {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw AppError.conflict("A user with this email already exists");
  }
}

export async function createUser(
  input: { name: string; email: string; password: string; role: string },
  actorId: string,
  meta: RequestMeta,
) {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash, role: input.role },
        select: PUBLIC_SELECT,
      });
      await recordEvent(tx, {
        entityType: "User",
        entityId: created.id,
        action: "CREATED",
        actorId,
        newValue: JSON.stringify({ name: created.name, email: created.email, role: created.role }),
      });
      await writeAudit(tx, {
        userId: actorId,
        action: "USER_CREATED",
        entityType: "User",
        entityId: created.id,
        metadata: { name: created.name, email: created.email, role: created.role },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return created;
    });
    return user;
  } catch (err) {
    conflictIfEmailTaken(err);
    throw err;
  }
}

export async function listUsers(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, select: PUBLIC_SELECT, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.user.count({ where }),
  ]);
  return pageResult(rows, total, page, pageSize);
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
  if (!user) throw AppError.notFound("User");
  return user;
}

export async function updateUser(
  id: string,
  input: { name?: string; email?: string; role?: string },
  actorId: string,
  meta: RequestMeta,
) {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("User");

  if (id === actorId && input.role && input.role !== before.role) {
    throw AppError.badRequest("You cannot change your own role");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
        },
        select: PUBLIC_SELECT,
      });
      const changes = diffFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        ["name", "email", "role"],
      );
      await recordChanges(tx, {
        entityType: "User",
        entityId: id,
        action: "UPDATED",
        changes,
        actorId,
      });
      await writeAudit(tx, {
        userId: actorId,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: id,
        metadata: { changes },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return after;
    });
    return updated;
  } catch (err) {
    conflictIfEmailTaken(err);
    throw err;
  }
}

export async function updateStatus(
  id: string,
  isActive: boolean,
  actorId: string,
  meta: RequestMeta,
) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("User");

  if (id === actorId && !isActive) {
    throw AppError.badRequest("You cannot deactivate your own account");
  }
  if (target.role === "SUPER_ADMIN" && target.isActive && !isActive) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      throw AppError.badRequest("Cannot deactivate the last active super admin");
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { isActive },
      select: PUBLIC_SELECT,
    });
    if (!isActive) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await recordEvent(tx, {
      entityType: "User",
      entityId: id,
      action: "STATUS_CHANGED",
      field: "isActive",
      oldValue: target.isActive,
      newValue: isActive,
      actorId,
    });
    await writeAudit(tx, {
      userId: actorId,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  });
}

export async function updatePassword(id: string, password: string, actorId: string, meta: RequestMeta) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("User");

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date() } }),
    // Kill every active session of that user.
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.recordHistory.create({
      data: {
        entityType: "User",
        entityId: id,
        action: "PASSWORD_CHANGED",
        actorId,
      },
    }),
    writeAudit(prisma, {
      userId: actorId,
      action: "USER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    }),
  ]);
  return { ok: true };
}

export async function userDropdown() {
  const data = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return { data };
}
