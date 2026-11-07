import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { diffFields, recordChanges, recordEvent } from "../../lib/history.js";
import { pageResult, parsePagination } from "../../lib/pagination.js";
import type { RequestMeta } from "../auth/service.js";

function conflictIfNameTaken(err: unknown): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw AppError.conflict("A category with this name already exists");
  }
}

export async function createCategory(
  input: { name: string; description?: string },
  actorId: string,
  meta: RequestMeta,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: { name: input.name, nameKey: input.name.toLowerCase(), description: input.description ?? null },
      });
      await recordEvent(tx, {
        entityType: "Category",
        entityId: category.id,
        action: "CREATED",
        actorId,
        newValue: category.name,
      });
      await writeAudit(tx, {
        userId: actorId,
        action: "CATEGORY_CREATED",
        entityType: "Category",
        entityId: category.id,
        metadata: { name: category.name },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return category;
    });
  } catch (err) {
    conflictIfNameTaken(err);
    throw err;
  }
}

export async function listCategories(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.CategoryWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search ? { name: { contains: query.search } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.category.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.category.count({ where }),
  ]);
  return pageResult(rows, total, page, pageSize);
}

export async function getCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw AppError.notFound("Category");
  return category;
}

export async function updateCategory(
  id: string,
  input: { name?: string; description?: string | null },
  actorId: string,
  meta: RequestMeta,
) {
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Category");
  try {
    return await prisma.$transaction(async (tx) => {
      const after = await tx.category.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name, nameKey: input.name.toLowerCase() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      const changes = diffFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        ["name", "description"],
      );
      await recordChanges(tx, { entityType: "Category", entityId: id, action: "UPDATED", changes, actorId });
      await writeAudit(tx, {
        userId: actorId,
        action: "CATEGORY_UPDATED",
        entityType: "Category",
        entityId: id,
        metadata: { changes },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return after;
    });
  } catch (err) {
    conflictIfNameTaken(err);
    throw err;
  }
}

export async function updateCategoryStatus(id: string, isActive: boolean, actorId: string, meta: RequestMeta) {
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Category");
  return prisma.$transaction(async (tx) => {
    const after = await tx.category.update({ where: { id }, data: { isActive } });
    await recordEvent(tx, {
      entityType: "Category",
      entityId: id,
      action: "STATUS_CHANGED",
      field: "isActive",
      oldValue: before.isActive,
      newValue: isActive,
      actorId,
    });
    await writeAudit(tx, {
      userId: actorId,
      action: isActive ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED",
      entityType: "Category",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return after;
  });
}

export async function categoryDropdown() {
  const data = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { data };
}
