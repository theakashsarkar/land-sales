import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { recordEvent } from "../../lib/history.js";
import { pageResult, parsePagination } from "../../lib/pagination.js";
import { assertProjectAccess } from "../../lib/access.js";
import { parseDateRange } from "../../lib/dates.js";
import type { AuthUser } from "../../types.js";
import type { RequestMeta } from "../auth/service.js";
import { serializeTransaction } from "../financial-records/service.js";

const recordInclude = {
  financialRecord: {
    select: {
      id: true,
      code: true,
      title: true,
      partyName: true,
      projectId: true,
      project: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

export async function listTransactions(
  actor: AuthUser,
  query: {
    page?: number;
    pageSize?: number;
    projectId?: string;
    financialRecordId?: string;
    method?: string;
    status?: string;
    createdById?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  if (query.projectId) {
    await assertProjectAccess(actor, query.projectId);
  }

  const where: Prisma.TransactionWhereInput = {
    financialRecord: {
      // Scope: regular users only see transactions of granted projects.
      ...(!query.projectId && actor.role !== "SUPER_ADMIN"
        ? { projectId: { in: (await prisma.projectUser.findMany({ where: { userId: actor.id }, select: { projectId: true } })).map((g) => g.projectId) } }
        : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { title: { contains: query.search } },
              { partyName: { contains: query.search } },
            ],
          }
        : {}),
    },
    ...(query.financialRecordId ? { financialRecordId: query.financialRecordId } : {}),
    ...(query.method ? { method: query.method } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.createdById ? { createdById: query.createdById } : {}),
    paidAt: parseDateRange(query.dateFrom, query.dateTo),
  };

  const { page, pageSize, skip, take } = parsePagination(query);
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        ...recordInclude,
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return pageResult(
    rows.map((r) => ({ ...serializeTransaction(r), financialRecord: r.financialRecord, createdBy: r.createdBy })),
    total,
    page,
    pageSize,
  );
}

async function loadForActor(actor: AuthUser, id: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { ...recordInclude, createdBy: { select: { id: true, name: true } }, voidedBy: { select: { id: true, name: true } } },
  });
  if (!tx) throw AppError.notFound("Transaction");
  await assertProjectAccess(actor, tx.financialRecord.projectId);
  return tx;
}

export async function getTransaction(actor: AuthUser, id: string) {
  const tx = await loadForActor(actor, id);
  return { ...serializeTransaction(tx), financialRecord: tx.financialRecord, createdBy: tx.createdBy };
}

export async function voidTransaction(actor: AuthUser, id: string, reason: string, meta: RequestMeta) {
  const existing = await loadForActor(actor, id);
  if (existing.status === "VOID") {
    throw AppError.conflict("Transaction is already void");
  }

  return prisma.$transaction(async (txDb) => {
    const updated = await txDb.transaction.update({
      where: { id },
      data: { status: "VOID", voidedById: actor.id, voidedAt: new Date(), voidReason: reason },
      include: { ...recordInclude, createdBy: { select: { id: true, name: true } }, voidedBy: { select: { id: true, name: true } } },
    });
    await recordEvent(txDb, {
      entityType: "Transaction",
      entityId: id,
      action: "VOIDED",
      actorId: actor.id,
      field: "status",
      oldValue: "VALID",
      newValue: "VOID",
    });
    await writeAudit(txDb, {
      userId: actor.id,
      action: "TRANSACTION_VOIDED",
      entityType: "Transaction",
      entityId: id,
      metadata: { reason, amount: serializeTransaction(updated).amount },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ...serializeTransaction(updated), financialRecord: updated.financialRecord, createdBy: updated.createdBy };
  });
}
