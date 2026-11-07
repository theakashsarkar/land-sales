import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { diffFields, recordChanges, recordEvent } from "../../lib/history.js";
import { pageResult, parsePagination } from "../../lib/pagination.js";
import { accessibleProjectIds, assertProjectAccess, projectScopeFilter } from "../../lib/access.js";
import { nextCode, withCodeRetry } from "../../lib/codes.js";
import { D, serializeMoney, toMoney } from "../../lib/money.js";
import { parseDateRange } from "../../lib/dates.js";
import type { AuthUser } from "../../types.js";
import type { RequestMeta } from "../auth/service.js";

const VALID_PAYMENT_FILTER = { type: "PAYMENT", status: "VALID" } as const;

function assertPositiveAmount(value: Prisma.Decimal) {
  if (value.lessThanOrEqualTo(0)) {
    throw AppError.badRequest("Amount must be greater than zero");
  }
}

async function paidSummary(recordId: string) {
  const agg = await prisma.transaction.aggregate({
    where: { financialRecordId: recordId, ...VALID_PAYMENT_FILTER },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return { paid: agg._sum.amount ?? D(0), count: agg._count._all };
}

function serializeRecordBase(record: {
  id: string;
  code: string;
  title: string;
  partyName: string;
  partyPhone: string | null;
  description: string | null;
  projectId: string;
  categoryId: string;
  totalAmount: Prisma.Decimal;
  status: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    partyName: record.partyName,
    partyPhone: record.partyPhone,
    description: record.description,
    projectId: record.projectId,
    categoryId: record.categoryId,
    totalAmount: serializeMoney(record.totalAmount),
    status: record.status,
    createdById: record.createdById,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function serializeRecordDetail(
  record: Prisma.FinancialRecordGetPayload<{
    include: { project: { select: { id: true, name: true, code: true } }; category: { select: { id: true, name: true } }; createdBy: { select: { id: true, name: true } } };
  }>,
) {
  const { paid, count } = await paidSummary(record.id);
  const remaining = D(record.totalAmount).minus(paid);
  return {
    ...serializeRecordBase(record),
    paidAmount: serializeMoney(paid),
    remainingAmount: serializeMoney(remaining),
    paymentCount: count,
    project: record.project,
    category: record.category,
    createdBy: record.createdBy,
  };
}

export async function createRecord(
  actor: AuthUser,
  input: {
    title: string;
    partyName: string;
    partyPhone?: string;
    description?: string;
    projectId: string;
    categoryId: string;
    totalAmount: string | number;
  },
  meta: RequestMeta,
) {
  const totalAmount = toMoney(input.totalAmount);
  assertPositiveAmount(totalAmount);

  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project || !project.isActive) {
    throw AppError.badRequest("Project does not exist or is inactive");
  }
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) {
    throw AppError.badRequest("Category does not exist or is inactive");
  }
  await assertProjectAccess(actor, input.projectId);

  const prefix = `FIN-${new Date().getUTCFullYear()}-`;
  const record = await withCodeRetry(() =>
    prisma.$transaction(async (tx) => {
      const created = await tx.financialRecord.create({
        data: {
          code: await nextCode(tx, "financialRecord", prefix),
          title: input.title,
          partyName: input.partyName,
          partyPhone: input.partyPhone ?? null,
          description: input.description ?? null,
          projectId: input.projectId,
          categoryId: input.categoryId,
          totalAmount,
          createdById: actor.id,
        },
      });
      await recordEvent(tx, {
        entityType: "FinancialRecord",
        entityId: created.id,
        action: "CREATED",
        actorId: actor.id,
        newValue: JSON.stringify({ code: created.code, title: created.title, totalAmount: serializeMoney(totalAmount) }),
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: "FINANCIAL_RECORD_CREATED",
        entityType: "FinancialRecord",
        entityId: created.id,
        metadata: { code: created.code, totalAmount: serializeMoney(totalAmount) },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return created;
    }),
  );
  return prisma.financialRecord.findUnique({
    where: { id: record.id },
    include: { project: { select: { id: true, name: true, code: true } }, category: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  }).then((r) => serializeRecordDetail(r!));
}

export async function listRecords(
  actor: AuthUser,
  query: {
    page?: number;
    pageSize?: number;
    search?: string;
    projectId?: string;
    categoryId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDir?: string;
  },
) {
  // An explicit project filter must be within the user's granted scope.
  if (query.projectId) {
    await assertProjectAccess(actor, query.projectId);
  }

  const scope = query.projectId
    ? { projectId: query.projectId }
    : await projectScopeFilter(actor);

  const where: Prisma.FinancialRecordWhereInput = {
    ...scope,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { title: { contains: query.search } },
            { partyName: { contains: query.search } },
          ],
        }
      : {}),
    createdAt: parseDateRange(query.dateFrom, query.dateTo),
  };

  const { page, pageSize, skip, take } = parsePagination(query);
  const sortBy = (query.sortBy ?? "createdAt") as "createdAt" | "totalAmount" | "code";
  const sortDir = (query.sortDir ?? "desc") as "asc" | "desc";

  const [rows, total] = await Promise.all([
    prisma.financialRecord.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip,
      take,
      include: { project: { select: { id: true, name: true, code: true } }, category: { select: { id: true, name: true } } },
    }),
    prisma.financialRecord.count({ where }),
  ]);

  // Batch paid totals for the page in a single groupBy.
  const ids = rows.map((r) => r.id);
  const sums = ids.length
    ? await prisma.transaction.groupBy({
        by: ["financialRecordId"],
        where: { financialRecordId: { in: ids }, ...VALID_PAYMENT_FILTER },
        _sum: { amount: true },
      })
    : [];
  const paidById = new Map(sums.map((s) => [s.financialRecordId, s._sum.amount ?? D(0)]));

  return pageResult(
    rows.map((r) => {
      const paid = paidById.get(r.id) ?? D(0);
      return {
        ...serializeRecordBase(r),
        paidAmount: serializeMoney(paid),
        remainingAmount: serializeMoney(D(r.totalAmount).minus(paid)),
        project: r.project,
        category: r.category,
      };
    }),
    total,
    page,
    pageSize,
  );
}

async function loadRecordForActor(actor: AuthUser, id: string) {
  const record = await prisma.financialRecord.findUnique({ where: { id } });
  if (!record) throw AppError.notFound("Financial record");
  await assertProjectAccess(actor, record.projectId);
  return record;
}

export async function getRecord(actor: AuthUser, id: string) {
  const record = await prisma.financialRecord.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true, code: true } }, category: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  });
  if (!record) throw AppError.notFound("Financial record");
  await assertProjectAccess(actor, record.projectId);
  return serializeRecordDetail(record);
}

export async function updateRecord(
  actor: AuthUser,
  id: string,
  input: {
    title?: string;
    partyName?: string;
    partyPhone?: string | null;
    description?: string | null;
    categoryId?: string;
    totalAmount?: string | number;
  },
  meta: RequestMeta,
) {
  const before = await loadRecordForActor(actor, id);
  if (before.status === "CANCELLED") {
    throw AppError.conflict("Cancelled records cannot be modified — reactivate it first");
  }

  let totalAmount: Prisma.Decimal | undefined;
  if (input.totalAmount !== undefined) {
    totalAmount = toMoney(input.totalAmount);
    assertPositiveAmount(totalAmount);
  }
  if (input.categoryId && input.categoryId !== before.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category || !category.isActive) {
      throw AppError.badRequest("Category does not exist or is inactive");
    }
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.financialRecord.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.partyName !== undefined ? { partyName: input.partyName } : {}),
        ...(input.partyPhone !== undefined ? { partyPhone: input.partyPhone } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(totalAmount !== undefined ? { totalAmount } : {}),
      },
      include: { project: { select: { id: true, name: true, code: true } }, category: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });
    const changes = diffFields(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      ["title", "partyName", "partyPhone", "description", "categoryId", "totalAmount"],
    );
    await recordChanges(tx, { entityType: "FinancialRecord", entityId: id, action: "UPDATED", changes, actorId: actor.id });
    await writeAudit(tx, {
      userId: actor.id,
      action: "FINANCIAL_RECORD_UPDATED",
      entityType: "FinancialRecord",
      entityId: id,
      metadata: { changes },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return serializeRecordDetail(after);
  });
}

export async function updateRecordStatus(
  actor: AuthUser,
  id: string,
  status: "ACTIVE" | "CANCELLED",
  meta: RequestMeta,
) {
  const before = await loadRecordForActor(actor, id);
  if (before.status === status) return getRecord(actor, id);
  return prisma.$transaction(async (tx) => {
    await tx.financialRecord.update({ where: { id }, data: { status } });
    await recordEvent(tx, {
      entityType: "FinancialRecord",
      entityId: id,
      action: "STATUS_CHANGED",
      field: "status",
      oldValue: before.status,
      newValue: status,
      actorId: actor.id,
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: status === "CANCELLED" ? "FINANCIAL_RECORD_CANCELLED" : "FINANCIAL_RECORD_REACTIVATED",
      entityType: "FinancialRecord",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }).then(() => getRecord(actor, id));
}

export async function recordPayment(
  actor: AuthUser,
  recordId: string,
  input: {
    amount: string | number;
    paidAt?: Date;
    method: string;
    reference?: string;
    note?: string;
  },
  meta: RequestMeta,
) {
  const record = await loadRecordForActor(actor, recordId);
  if (record.status !== "ACTIVE") {
    throw AppError.conflict("Cannot record payments against a cancelled record");
  }
  const amount = toMoney(input.amount);
  assertPositiveAmount(amount);

  const result = await prisma
    .$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          financialRecordId: recordId,
          type: "PAYMENT",
          amount,
          paidAt: input.paidAt ?? new Date(),
          method: input.method,
          reference: input.reference ?? null,
          note: input.note ?? null,
          createdById: actor.id,
        },
      });
    await recordEvent(tx, {
      entityType: "Transaction",
      entityId: transaction.id,
      action: "PAYMENT_RECORDED",
      actorId: actor.id,
      newValue: JSON.stringify({
        amount: serializeMoney(amount),
        method: input.method,
        reference: input.reference ?? null,
      }),
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "TRANSACTION_RECORDED",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: { financialRecordId: recordId, amount: serializeMoney(amount), method: input.method },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const agg = await tx.transaction.aggregate({
      where: { financialRecordId: recordId, ...VALID_PAYMENT_FILTER },
      _sum: { amount: true },
    });
    const paid = agg._sum.amount ?? D(0);
    return { transaction, paid };
    })
    .catch((err: unknown) => {
      // Per-record unique reference: a retried/double-submitted payment
      // with the same reference is rejected instead of double-counted.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw AppError.conflict(
          "A payment with this reference already exists for this record",
          "DUPLICATE_REFERENCE",
        );
      }
      throw err;
    });

  return {
    transaction: serializeTransaction(result.transaction),
    recordSummary: {
      totalAmount: serializeMoney(record.totalAmount),
      paidAmount: serializeMoney(result.paid),
      remainingAmount: serializeMoney(D(record.totalAmount).minus(result.paid)),
    },
  };
}

export function serializeTransaction(t: {
  id: string;
  financialRecordId: string;
  type: string;
  amount: Prisma.Decimal;
  paidAt: Date;
  method: string;
  reference: string | null;
  note: string | null;
  status: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  voidedById?: string | null;
  voidedAt?: Date | null;
  voidReason?: string | null;
}) {
  return {
    id: t.id,
    financialRecordId: t.financialRecordId,
    type: t.type,
    amount: serializeMoney(t.amount),
    paidAt: t.paidAt.toISOString(),
    method: t.method,
    reference: t.reference,
    note: t.note,
    status: t.status,
    createdById: t.createdById,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    voidedById: t.voidedById ?? null,
    voidedAt: t.voidedAt?.toISOString() ?? null,
    voidReason: t.voidReason ?? null,
  };
}

export async function recordHistory(actor: AuthUser, recordId: string) {
  const record = await loadRecordForActor(actor, recordId);
  const rows = await prisma.recordHistory.findMany({
    where: { entityType: "FinancialRecord", entityId: record.id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true } } },
  });
  return {
    data: rows.map((r) => ({
      id: r.id,
      action: r.action,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      actor: r.actor,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function recordTransactions(actor: AuthUser, recordId: string, query: { page?: number; pageSize?: number }) {
  const record = await loadRecordForActor(actor, recordId);
  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { financialRecordId: record.id };
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);
  return pageResult(
    rows.map((r) => ({ ...serializeTransaction(r), createdBy: r.createdBy })),
    total,
    page,
    pageSize,
  );
}

export { accessibleProjectIds };
