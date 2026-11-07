import { prisma } from "../../lib/prisma.js";
import { D, serializeMoney } from "../../lib/money.js";
import { accessibleProjectIds } from "../../lib/access.js";
import type { AuthUser } from "../../types.js";

interface MoneyBucket {
  recordCount: number;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
}

function emptyBucket(): MoneyBucket {
  return { recordCount: 0, totalAmount: "0.00", paidAmount: "0.00", remainingAmount: "0.00" };
}

/**
 * Role-aware dashboard. SUPER_ADMIN sees system-wide numbers; USER sees
 * everything restricted to their assigned projects and never sees user
 * administration counts.
 */
export async function buildDashboard(actor: AuthUser) {
  const scopeIds = await accessibleProjectIds(actor);
  const recordScope = scopeIds === null ? {} : { projectId: { in: scopeIds } };

  const records = await prisma.financialRecord.findMany({
    where: { ...recordScope, status: "ACTIVE" },
    select: { id: true, projectId: true, categoryId: true, totalAmount: true },
  });

  const payments = await prisma.transaction.groupBy({
    by: ["financialRecordId"],
    where: {
      type: "PAYMENT",
      status: "VALID",
      financialRecord: { ...recordScope },
    },
    _sum: { amount: true },
  });
  const paidByRecord = new Map(payments.map((p) => [p.financialRecordId, p._sum.amount ?? D(0)]));

  const projects = await prisma.project.findMany({
    where: scopeIds === null ? {} : { id: { in: scopeIds } },
    select: { id: true, name: true, code: true, isActive: true },
  });
  const categories = await prisma.category.findMany({ select: { id: true, name: true, isActive: true } });

  const projectBuckets = new Map<string, MoneyBucket & { project: { id: string; name: string; code: string } }>();
  const categoryBuckets = new Map<string, MoneyBucket & { category: { id: string; name: string } }>();
  const grand = { total: D(0), paid: D(0) };

  for (const record of records) {
    const paid = paidByRecord.get(record.id) ?? D(0);
    grand.total = grand.total.plus(record.totalAmount);
    grand.paid = grand.paid.plus(paid);

    const project = projects.find((p) => p.id === record.projectId);
    if (project) {
      const bucket = projectBuckets.get(record.projectId) ?? {
        project: { id: project.id, name: project.name, code: project.code },
        ...emptyBucket(),
      };
      bucket.recordCount += 1;
      bucket.totalAmount = D(bucket.totalAmount).plus(record.totalAmount).toFixed(2);
      bucket.paidAmount = D(bucket.paidAmount).plus(paid).toFixed(2);
      bucket.remainingAmount = D(bucket.remainingAmount).plus(D(record.totalAmount).minus(paid)).toFixed(2);
      projectBuckets.set(record.projectId, bucket);
    }

    const category = categories.find((c) => c.id === record.categoryId);
    if (category) {
      const bucket = categoryBuckets.get(record.categoryId) ?? {
        category: { id: category.id, name: category.name },
        ...emptyBucket(),
      };
      bucket.recordCount += 1;
      bucket.totalAmount = D(bucket.totalAmount).plus(record.totalAmount).toFixed(2);
      bucket.paidAmount = D(bucket.paidAmount).plus(paid).toFixed(2);
      bucket.remainingAmount = D(bucket.remainingAmount).plus(D(record.totalAmount).minus(paid)).toFixed(2);
      categoryBuckets.set(record.categoryId, bucket);
    }
  }

  const recentTransactions = await prisma.transaction.findMany({
    where: { financialRecord: recordScope },
    orderBy: [{ createdAt: "desc" }],
    take: 10,
    include: {
      financialRecord: {
        select: {
          id: true,
          code: true,
          title: true,
          projectId: true,
          project: { select: { id: true, name: true, code: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const isAdmin = actor.role === "SUPER_ADMIN";
  const [userCount, activeUserCount] = await Promise.all([
    isAdmin ? prisma.user.count() : Promise.resolve(0),
    isAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),
  ]);

  const projectCount = projects.length;
  const activeProjectCount = projects.filter((p) => p.isActive).length;
  const relevantCategoryIds = new Set(records.map((r) => r.categoryId));
  const visibleCategories = categories.filter((c) => relevantCategoryIds.has(c.id));

  return {
    role: actor.role,
    counts: {
      users: isAdmin ? { total: userCount, active: activeUserCount } : null,
      projects: { total: projectCount, active: activeProjectCount },
      categories: { total: visibleCategories.length, active: visibleCategories.filter((c) => c.isActive).length },
    },
    financial: {
      totalAmount: serializeMoney(grand.total),
      totalPaidAmount: serializeMoney(grand.paid),
      totalRemainingAmount: serializeMoney(grand.total.minus(grand.paid)),
      activeRecordCount: records.length,
    },
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      amount: serializeMoney(t.amount),
      paidAt: t.paidAt.toISOString(),
      method: t.method,
      status: t.status,
      financialRecord: t.financialRecord,
      createdBy: t.createdBy,
    })),
    projectSummaries: [...projectBuckets.values()].sort((a, b) =>
      Number(b.totalAmount) - Number(a.totalAmount),
    ),
    categorySummaries: [...categoryBuckets.values()].sort((a, b) =>
      Number(b.totalAmount) - Number(a.totalAmount),
    ),
  };
}
