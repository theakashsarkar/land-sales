import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { recordEvent } from "../../lib/history.js";
import { pageResult, parsePagination } from "../../lib/pagination.js";
import { assertProjectAccess } from "../../lib/access.js";
import { nextCode, withCodeRetry } from "../../lib/codes.js";
import { D, serializeMoney, toMoney } from "../../lib/money.js";
import { parseDateRange } from "../../lib/dates.js";
import { buildDocumentPdf, formatMoneyForDoc } from "../../lib/pdf.js";
import type { AuthUser } from "../../types.js";
import type { RequestMeta } from "../auth/service.js";

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>;

function serializeInvoice(inv: InvoiceWithItems) {
  return {
    id: inv.id,
    number: inv.number,
    type: inv.type,
    status: inv.status,
    financialRecordId: inv.financialRecordId,
    transactionId: inv.transactionId,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    subtotal: serializeMoney(inv.subtotal),
    total: serializeMoney(inv.total),
    notes: inv.notes,
    partyName: inv.partyName,
    partyPhone: inv.partyPhone,
    projectCode: inv.projectCode,
    projectTitle: inv.projectTitle,
    categoryTitle: inv.categoryTitle,
    recordCode: inv.recordCode,
    createdById: inv.createdById,
    createdAt: inv.createdAt.toISOString(),
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    cancelledById: inv.cancelledById,
    cancelReason: inv.cancelReason,
    items: inv.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: serializeMoney(it.quantity),
      unitPrice: serializeMoney(it.unitPrice),
      amount: serializeMoney(it.amount),
    })),
  };
}

export async function createInvoice(
  actor: AuthUser,
  input: {
    financialRecordId: string;
    items: { description: string; quantity: number; unitPrice: string | number }[];
    dueDate?: Date;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const record = await prisma.financialRecord.findUnique({
    where: { id: input.financialRecordId },
    include: { project: true, category: true },
  });
  if (!record) throw AppError.notFound("Financial record");
  await assertProjectAccess(actor, record.projectId);
  if (record.status !== "ACTIVE") {
    throw AppError.conflict("Cannot issue invoices against a cancelled record");
  }

  const items = input.items.map((it) => {
    const unitPrice = toMoney(it.unitPrice);
    const amount = toMoney(D(unitPrice).times(it.quantity));
    return { description: it.description, quantity: toMoney(it.quantity), unitPrice, amount };
  });
  const subtotal = items.reduce((acc, it) => acc.plus(it.amount), D(0));

  const prefix = `INV-${new Date().getUTCFullYear()}-`;
  const invoice = await withCodeRetry(() =>
    prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          number: await nextCode(tx, "invoice", prefix),
          type: "INVOICE",
          financialRecordId: record.id,
          status: "ISSUED",
          issueDate: new Date(),
          dueDate: input.dueDate ?? null,
          subtotal,
          total: subtotal,
          notes: input.notes ?? null,
          // historical snapshots
          partyName: record.partyName,
          partyPhone: record.partyPhone,
          projectCode: record.project.code,
          projectTitle: record.project.name,
          categoryTitle: record.category.name,
          recordCode: record.code,
          createdById: actor.id,
          items: { create: items },
        },
        include: { items: true },
      });
      await recordEvent(tx, {
        entityType: "Invoice",
        entityId: created.id,
        action: "CREATED",
        actorId: actor.id,
        newValue: JSON.stringify({ number: created.number, total: serializeMoney(created.total) }),
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: created.id,
        metadata: { number: created.number, total: serializeMoney(created.total) },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return created;
    }),
  );
  return serializeInvoice(invoice);
}

export async function createReceipt(actor: AuthUser, transactionId: string, meta: RequestMeta) {
  const txRow = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      financialRecord: { include: { project: true, category: true } },
    },
  });
  if (!txRow) throw AppError.notFound("Transaction");
  await assertProjectAccess(actor, txRow.financialRecord.projectId);
  if (txRow.status !== "VALID") {
    throw AppError.conflict("Cannot issue a receipt for a void transaction");
  }

  const existing = await prisma.invoice.findFirst({ where: { transactionId } });
  if (existing) {
    throw AppError.conflict("A receipt has already been issued for this payment");
  }

  const record = txRow.financialRecord;
  const prefix = `RCP-${new Date().getUTCFullYear()}-`;
  const invoice = await withCodeRetry(() =>
    prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          number: await nextCode(tx, "invoice", prefix),
          type: "RECEIPT",
          financialRecordId: record.id,
          transactionId,
          status: "ISSUED",
          issueDate: new Date(),
          subtotal: txRow.amount,
          total: txRow.amount,
          partyName: record.partyName,
          partyPhone: record.partyPhone,
          projectCode: record.project.code,
          projectTitle: record.project.name,
          categoryTitle: record.category.name,
          recordCode: record.code,
          createdById: actor.id,
          items: {
            create: [
              {
                description: `Payment received against ${record.code} (${txRow.method}${txRow.reference ? `, ref ${txRow.reference}` : ""})`,
                quantity: 1,
                unitPrice: txRow.amount,
                amount: txRow.amount,
              },
            ],
          },
        },
        include: { items: true },
      });
      await recordEvent(tx, {
        entityType: "Invoice",
        entityId: created.id,
        action: "CREATED",
        actorId: actor.id,
        newValue: JSON.stringify({ number: created.number, total: serializeMoney(created.total) }),
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: "RECEIPT_CREATED",
        entityType: "Invoice",
        entityId: created.id,
        metadata: { number: created.number, transactionId },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return created;
    }),
  );
  return serializeInvoice(invoice);
}

export async function listInvoices(
  actor: AuthUser,
  query: {
    page?: number;
    pageSize?: number;
    type?: string;
    status?: string;
    financialRecordId?: string;
    projectId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  if (query.projectId) await assertProjectAccess(actor, query.projectId);

  const where: Prisma.InvoiceWhereInput = {
    financialRecord: {
      ...(!query.projectId && actor.role !== "SUPER_ADMIN"
        ? {
            projectId: {
              in: (await prisma.projectUser.findMany({ where: { userId: actor.id }, select: { projectId: true } })).map(
                (g) => g.projectId,
              ),
            },
          }
        : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
    },
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.financialRecordId ? { financialRecordId: query.financialRecordId } : {}),
    ...(query.search
      ? {
          OR: [
            { number: { contains: query.search } },
            { partyName: { contains: query.search } },
            { recordCode: { contains: query.search } },
          ],
        }
      : {}),
    issueDate: parseDateRange(query.dateFrom, query.dateTo),
  };

  const { page, pageSize, skip, take } = parsePagination(query);
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy: { issueDate: "desc" }, skip, take, include: { items: true } }),
    prisma.invoice.count({ where }),
  ]);
  return pageResult(rows.map(serializeInvoice), total, page, pageSize);
}

async function loadInvoiceForActor(actor: AuthUser, id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
  if (!invoice) throw AppError.notFound("Invoice");
  const record = await prisma.financialRecord.findUnique({ where: { id: invoice.financialRecordId } });
  if (!record) throw AppError.notFound("Financial record");
  await assertProjectAccess(actor, record.projectId);
  return invoice;
}

export async function getInvoice(actor: AuthUser, id: string) {
  return serializeInvoice(await loadInvoiceForActor(actor, id));
}

export async function cancelInvoice(actor: AuthUser, id: string, reason: string, meta: RequestMeta) {
  const invoice = await loadInvoiceForActor(actor, id);
  if (invoice.status === "CANCELLED") throw AppError.conflict("Invoice is already cancelled");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actor.id, cancelReason: reason },
      include: { items: true },
    });
    await recordEvent(tx, {
      entityType: "Invoice",
      entityId: id,
      action: "CANCELLED",
      actorId: actor.id,
      field: "status",
      oldValue: "ISSUED",
      newValue: "CANCELLED",
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "INVOICE_CANCELLED",
      entityType: "Invoice",
      entityId: id,
      metadata: { reason, number: invoice.number },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return serializeInvoice(updated);
  });
}

export async function invoicePdf(actor: AuthUser, id: string): Promise<{ buffer: Buffer; number: string }> {
  const inv = await loadInvoiceForActor(actor, id);
  const isReceipt = inv.type === "RECEIPT";

  const buffer = await buildDocumentPdf(
    {
      orgName: "Bhumi Landmarks Ltd.",
      orgLines: ["House 42, Road 11, Banani, Dhaka 1213, Bangladesh", "info@bhumilandmarks.com"],
      title: isReceipt ? `MONEY RECEIPT — ${inv.number}` : `INVOICE — ${inv.number}`,
      subtitle: `Issue date: ${inv.issueDate.toLocaleDateString("en-GB")}${inv.dueDate ? ` · Due: ${inv.dueDate.toLocaleDateString("en-GB")}` : ""}`,
    },
    [
      {
        kind: "keyValue",
        rows: [
          ["Bill to", inv.partyName],
          ["Phone", inv.partyPhone ?? "—"],
          ["Project", `${inv.projectTitle} (${inv.projectCode})`],
          ["Category", inv.categoryTitle],
          ["Record", inv.recordCode],
          ["Status", inv.status],
        ],
      },
      {
        kind: "table",
        table: {
          columns: [
            { header: "#", width: 24 },
            { header: "Description", width: 311 },
            { header: "Qty", width: 50, align: "right" },
            { header: "Unit price (BDT)", width: 85, align: "right" },
            { header: "Amount (BDT)", width: 85, align: "right" },
          ],
          rows: inv.items.map((it, i) => [
            String(i + 1),
            it.description,
            String(Number(it.quantity)),
            formatMoneyForDoc(it.unitPrice),
            formatMoneyForDoc(it.amount),
          ]),
          footer: [
            { label: "Subtotal", value: `BDT ${formatMoneyForDoc(inv.subtotal)}` },
            { label: "Total", value: `BDT ${formatMoneyForDoc(inv.total)}` },
          ],
        },
      },
      ...(inv.notes ? [{ kind: "text" as const, text: `Notes: ${inv.notes}` }] : []),
      ...(inv.cancelReason ? [{ kind: "text" as const, text: `CANCELLED: ${inv.cancelReason}` }] : []),
    ],
  );
  return { buffer, number: inv.number };
}
