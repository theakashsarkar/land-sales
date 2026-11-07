import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { assertProjectAccess } from "../../lib/access.js";
import { D, serializeMoney } from "../../lib/money.js";
import { parseDateRange } from "../../lib/dates.js";
import { pageResult } from "../../lib/pagination.js";
import { buildDocumentPdf } from "../../lib/pdf.js";
import { buildWorkbook } from "../../lib/excel.js";
import type { AuthUser } from "../../types.js";

export interface ReportQuery {
  from?: string;
  to?: string;
  projectId?: string;
}

export interface ReportTable {
  title: string;
  subtitle?: string;
  columns: { header: string; width?: number; align?: "left" | "right" }[];
  rows: (string | number | null)[][];
  footers?: { label: string; value: string }[];
}

interface Resolved {
  table: ReportTable;
  json: unknown;
}

/** Scoped where-clause for joins on financialRecord (payments/transactions). */
async function recordJoinScope(actor: AuthUser, projectId?: string): Promise<Prisma.FinancialRecordWhereInput> {
  if (projectId) {
    await assertProjectAccess(actor, projectId);
    return { projectId };
  }
  if (actor.role !== "SUPER_ADMIN") {
    const grants = await prisma.projectUser.findMany({ where: { userId: actor.id }, select: { projectId: true } });
    return { projectId: { in: grants.map((g) => g.projectId) } };
  }
  return {};
}

async function validPayments(actor: AuthUser, query: ReportQuery) {
  return prisma.transaction.findMany({
    where: {
      type: "PAYMENT",
      status: "VALID",
      financialRecord: await recordJoinScope(actor, query.projectId),
      paidAt: parseDateRange(query.from, query.to),
    },
    include: {
      financialRecord: { select: { code: true, project: { select: { id: true, name: true, code: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { paidAt: "asc" },
  });
}

/* ---------------- date-wise ---------------- */

export async function dateWiseReport(actor: AuthUser, query: ReportQuery): Promise<Resolved> {
  const payments = await validPayments(actor, query);
  const byDate = new Map<string, { count: number; total: Prisma.Decimal }>();
  for (const p of payments) {
    const date = p.paidAt.toISOString().slice(0, 10);
    const bucket = byDate.get(date) ?? { count: 0, total: D(0) };
    bucket.count += 1;
    bucket.total = bucket.total.plus(p.amount);
    byDate.set(date, bucket);
  }
  const rows = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({ date, transactionCount: b.count, total: serializeMoney(b.total) }));

  return {
    json: { format: "json" as const, generatedAt: new Date().toISOString(), rows },
    table: {
      title: "Date-wise collection report",
      subtitle: query.from || query.to ? `Period: ${query.from ?? "…"} to ${query.to ?? "…"}` : "All time",
      columns: [{ header: "Date" }, { header: "Transactions", align: "right" }, { header: "Total (BDT)", align: "right" }],
      rows: rows.map((r) => [r.date, r.transactionCount, r.total]),
      footers: [
        { label: "Grand total", value: `BDT ${serializeMoney(rows.reduce((acc, r) => acc.plus(r.total ?? "0"), D(0)))}` },
      ],
    },
  };
}

/* ---------------- user-wise ---------------- */

export async function userWiseReport(actor: AuthUser, query: ReportQuery): Promise<Resolved> {
  const payments = await validPayments(actor, query);
  const byUser = new Map<string, { user: { id: string; name: string; email: string }; count: number; total: Prisma.Decimal }>();
  for (const p of payments) {
    const bucket = byUser.get(p.createdById) ?? { user: p.createdBy, count: 0, total: D(0) };
    bucket.count += 1;
    bucket.total = bucket.total.plus(p.amount);
    byUser.set(p.createdById, bucket);
  }
  const rows = [...byUser.values()]
    .map((b) => ({ user: b.user, transactionCount: b.count, total: serializeMoney(b.total) }))
    .sort((a, b) => Number(b.total) - Number(a.total));

  return {
    json: { format: "json" as const, generatedAt: new Date().toISOString(), rows },
    table: {
      title: "User-wise collection report",
      subtitle: query.from || query.to ? `Period: ${query.from ?? "…"} to ${query.to ?? "…"}` : "All time",
      columns: [
        { header: "Recorded by" },
        { header: "Email" },
        { header: "Transactions", align: "right" },
        { header: "Total (BDT)", align: "right" },
      ],
      rows: rows.map((r) => [r.user.name, r.user.email, r.transactionCount, r.total]),
    },
  };
}

/* ---------------- project-wise / category-wise ---------------- */

async function recordScope(actor: AuthUser, projectId?: string): Promise<Prisma.FinancialRecordWhereInput> {
  if (projectId) {
    await assertProjectAccess(actor, projectId);
    return { projectId };
  }
  if (actor.role !== "SUPER_ADMIN") {
    const grants = await prisma.projectUser.findMany({ where: { userId: actor.id }, select: { projectId: true } });
    return { projectId: { in: grants.map((g) => g.projectId) } };
  }
  return {};
}

async function groupWise(
  actor: AuthUser,
  query: ReportQuery,
  dimension: "project" | "category",
): Promise<Resolved> {
  const scope = await recordScope(actor, query.projectId);
  const records = await prisma.financialRecord.findMany({
    where: { ...scope, status: "ACTIVE" },
    include: {
      project: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true } },
    },
  });
  const payments = await prisma.transaction.groupBy({
    by: ["financialRecordId"],
    where: { type: "PAYMENT", status: "VALID", financialRecord: scope },
    _sum: { amount: true },
  });
  const paidByRecord = new Map(payments.map((p) => [p.financialRecordId, p._sum.amount ?? D(0)]));

  interface Bucket {
    entity: { id: string; name: string; code?: string };
    recordCount: number;
    total: Prisma.Decimal;
    paid: Prisma.Decimal;
  }
  const buckets = new Map<string, Bucket>();
  for (const r of records) {
    const entity =
      dimension === "project"
        ? { id: r.project.id, name: r.project.name, code: r.project.code }
        : { id: r.category.id, name: r.category.name };
    const bucket = buckets.get(entity.id) ?? { entity, recordCount: 0, total: D(0), paid: D(0) };
    bucket.recordCount += 1;
    bucket.total = bucket.total.plus(r.totalAmount);
    bucket.paid = bucket.paid.plus(paidByRecord.get(r.id) ?? D(0));
    buckets.set(entity.id, bucket);
  }

  const rows = [...buckets.values()]
    .map((b) => ({
      [dimension]: b.entity,
      recordCount: b.recordCount,
      totalAmount: serializeMoney(b.total),
      paidAmount: serializeMoney(b.paid),
      remainingAmount: serializeMoney(b.total.minus(b.paid)),
      sortKey: Number(b.total),
    }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey, ...r }) => {
      void sortKey;
      return r;
    });

  const labelOf = (r: (typeof rows)[number]) =>
    dimension === "project"
      ? `${(r.project as { name: string; code: string }).name} (${(r.project as { code: string }).code})`
      : (r.category as { name: string }).name;

  return {
    json: { format: "json" as const, generatedAt: new Date().toISOString(), rows },
    table: {
      title: dimension === "project" ? "Project-wise financial report" : "Category-wise financial report",
      subtitle: "Active records only",
      columns: [
        { header: dimension === "project" ? "Project" : "Category" },
        { header: "Records", align: "right" },
        { header: "Total (BDT)", align: "right" },
        { header: "Paid (BDT)", align: "right" },
        { header: "Remaining (BDT)", align: "right" },
      ],
      rows: rows.map((r) => [labelOf(r), r.recordCount, r.totalAmount, r.paidAmount, r.remainingAmount]),
      footers: [
        {
          label: "Grand total",
          value: `BDT ${serializeMoney(rows.reduce((acc, r) => acc.plus(r.totalAmount ?? "0"), D(0)))}`,
        },
      ],
    },
  };
}

export const projectWiseReport = (actor: AuthUser, query: ReportQuery) => groupWise(actor, query, "project");
export const categoryWiseReport = (actor: AuthUser, query: ReportQuery) => groupWise(actor, query, "category");

/* ---------------- financial summary ---------------- */

export async function financialSummaryReport(actor: AuthUser, query: ReportQuery): Promise<Resolved> {
  const scope = await recordScope(actor, query.projectId);
  const records = await prisma.financialRecord.findMany({
    where: { ...scope, status: "ACTIVE" },
    select: { id: true, totalAmount: true },
  });
  const payments = await prisma.transaction.findMany({
    where: {
      type: "PAYMENT",
      status: "VALID",
      financialRecord: scope,
      paidAt: parseDateRange(query.from, query.to),
    },
    select: { amount: true, method: true },
  });

  const totalAmount = records.reduce((acc, r) => acc.plus(r.totalAmount), D(0));
  const totalPaid = payments.reduce((acc, p) => acc.plus(p.amount), D(0));

  const byMethod = new Map<string, { count: number; total: Prisma.Decimal }>();
  for (const p of payments) {
    const b = byMethod.get(p.method) ?? { count: 0, total: D(0) };
    b.count += 1;
    b.total = b.total.plus(p.amount);
    byMethod.set(p.method, b);
  }
  const methodRows = [...byMethod.entries()]
    .map(([method, b]) => ({ method, count: b.count, total: serializeMoney(b.total) }))
    .sort((a, b) => Number(b.total) - Number(a.total));

  const totals = {
    totalAmount: serializeMoney(totalAmount),
    totalPaidAmount: serializeMoney(totalPaid),
    totalRemainingAmount: serializeMoney(totalAmount.minus(totalPaid)),
    activeRecordCount: records.length,
  };

  return {
    json: { format: "json" as const, generatedAt: new Date().toISOString(), totals, byMethod: methodRows },
    table: {
      title: "Financial summary",
      subtitle: query.from || query.to ? `Payments period: ${query.from ?? "…"} to ${query.to ?? "…"}` : "All time",
      columns: [{ header: "Method" }, { header: "Transactions", align: "right" }, { header: "Total (BDT)", align: "right" }],
      rows: methodRows.map((m) => [m.method, m.count, m.total]),
      footers: [
        { label: "Total receivable (active records)", value: `BDT ${totals.totalAmount}` },
        { label: "Total collected", value: `BDT ${totals.totalPaidAmount}` },
        { label: "Total remaining", value: `BDT ${totals.totalRemainingAmount}` },
      ],
    },
  };
}

/* ---------------- transaction history report ---------------- */

export async function transactionsReport(
  actor: AuthUser,
  query: ReportQuery & {
    page?: number;
    pageSize?: number;
    method?: string;
    status?: string;
    createdById?: string;
    search?: string;
    format?: string;
  },
): Promise<Resolved> {
  const scope = await recordJoinScope(actor, query.projectId);
  const where: Prisma.TransactionWhereInput = {
    financialRecord: scope,
    ...(query.method ? { method: query.method } : {}),
    ...(query.status ? { status: query.status } : { status: "VALID" }),
    ...(query.createdById ? { createdById: query.createdById } : {}),
    ...(query.search
      ? {
          OR: [
            { reference: { contains: query.search } },
            { note: { contains: query.search } },
            { financialRecord: { code: { contains: query.search } } },
          ],
        }
      : {}),
    paidAt: parseDateRange(query.from, query.to),
  };

  const include = {
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
  } as const;

  const { page, pageSize } =
    query.format === "json"
      ? { page: query.page ?? 1, pageSize: query.pageSize ?? 20 }
      : { page: 1, pageSize: 5000 };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      include,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  const serialize = (t: (typeof rows)[number]) => ({
    id: t.id,
    amount: serializeMoney(t.amount),
    paidAt: t.paidAt.toISOString(),
    method: t.method,
    status: t.status,
    reference: t.reference,
    financialRecord: t.financialRecord,
    createdBy: t.createdBy,
  });

  return {
    json: {
      format: "json" as const,
      rows: rows.map(serialize),
      meta: pageResult([], total, page, pageSize).meta,
    },
    table: {
      title: "Transaction history report",
      subtitle: `${query.from ?? "…"} to ${query.to ?? "…"}`,
      columns: [
        { header: "Date" },
        { header: "Record" },
        { header: "Project" },
        { header: "Method" },
        { header: "Status" },
        { header: "Recorded by" },
        { header: "Amount (BDT)", align: "right" },
      ],
      rows: rows.map((t) => [
        t.paidAt.toISOString().slice(0, 10),
        t.financialRecord.code,
        t.financialRecord.project?.name ?? "",
        t.method,
        t.status,
        t.createdBy.name,
        serializeMoney(t.amount),
      ]),
      footers: [
        {
          label: "Total",
          value: `BDT ${serializeMoney(rows.reduce((acc, t) => acc.plus(t.amount), D(0)))}`,
        },
      ],
    },
  };
}

/* ---------------- renderers ---------------- */

export type ExportFormat = "pdf" | "xlsx";

export async function renderTable(
  table: ReportTable,
  format: ExportFormat,
  slug: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  if (format === "xlsx") {
    const buffer = await buildWorkbook([
      {
        name: table.title.slice(0, 31) || "Report",
        columns: table.columns.map((c) => ({ header: c.header, width: c.width })),
        rows: table.rows,
      },
    ]);
    return {
      buffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${slug}.xlsx`,
    };
  }

  const columnWidth = Math.floor(515 / table.columns.length);
  const buffer = await buildDocumentPdf(
    {
      orgName: "Bhumi Landmarks Ltd.",
      orgLines: ["House 42, Road 11, Banani, Dhaka 1213, Bangladesh"],
      title: table.title,
      subtitle: table.subtitle,
    },
    [
      {
        kind: "table",
        table: {
          columns: table.columns.map((c) => ({
            header: c.header,
            width: Math.min(c.width ?? columnWidth, 220),
            align: c.align,
          })),
          rows: table.rows.map((row) => row.map((cell) => cell ?? "")),
          footer: table.footers,
        },
      },
    ],
  );
  return { buffer, contentType: "application/pdf", filename: `${slug}.pdf` };
}
