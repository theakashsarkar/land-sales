import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  makeCategory,
  makeFinancialRecord,
  makeProject,
  resetDb,
  saContext,
  uniqueEmail,
  userContext,
} from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const invoicesRoute = "/api/v1/invoices";
const frRoute = "/api/v1/financial-records";

interface Setup {
  sa: Awaited<ReturnType<typeof saContext>>;
  record: Awaited<ReturnType<typeof makeFinancialRecord>>;
  project: Awaited<ReturnType<typeof makeProject>>;
}

async function setup(): Promise<Setup> {
  const sa = await saContext();
  const project = await makeProject();
  const category = await makeCategory();
  const record = await makeFinancialRecord({
    projectId: project.id,
    categoryId: category.id,
    totalAmount: "500000",
    partyName: "Anwar Hossain",
    partyPhone: "+8801700000000",
    actorId: sa.user.id,
  });
  return { sa, record, project };
}

async function createInvoice(token: string, recordId: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(invoicesRoute)
    .set("Authorization", `Bearer ${token}`)
    .send({
      financialRecordId: recordId,
      items: [{ description: "Down payment demand", quantity: 1, unitPrice: "100000" }],
      ...overrides,
    });
}

async function pay(token: string, recordId: string, amount: string, reference?: string) {
  const res = await request(app)
    .post(`${frRoute}/${recordId}/payments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount, reference, method: "BANK" });
  expect(res.status).toBe(201);
  return res.body.transaction as { id: string; amount: string };
}

describe("POST /invoices", () => {
  it("creates an invoice with sequential INV number, computed totals, and snapshots", async () => {
    const { sa, record } = await setup();
    const res = await createInvoice(sa.accessToken, record.id, {
      items: [
        { description: "Installment 1", quantity: 2, unitPrice: "1250.50" },
        { description: "Service charge", quantity: 1, unitPrice: "1000" },
      ],
      dueDate: "2026-12-31",
      notes: "Payable at any branch",
    });

    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(res.body.type).toBe("INVOICE");
    expect(res.body.status).toBe("ISSUED");
    expect(res.body.subtotal).toBe("3501.00");
    expect(res.body.total).toBe("3501.00");
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].amount).toBe("2501.00");
    // snapshots from the record at issue time
    expect(res.body.partyName).toBe("Anwar Hossain");
    expect(res.body.recordCode).toBe(record.code);
  });

  it("second invoice gets the next sequential number", async () => {
    const { sa, record } = await setup();
    const first = await createInvoice(sa.accessToken, record.id);
    const second = await createInvoice(sa.accessToken, record.id);
    const n1 = Number(first.body.number.slice(-6));
    const n2 = Number(second.body.number.slice(-6));
    expect(n2).toBe(n1 + 1);
  });

  it("snapshots are historical: later record edits do not change the invoice", async () => {
    const { sa, record } = await setup();
    const inv = await createInvoice(sa.accessToken, record.id);
    await request(app)
      .patch(`${frRoute}/${record.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ partyName: "Changed Name", title: "Changed Title" });

    const detail = await request(app)
      .get(`${invoicesRoute}/${inv.body.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(detail.body.partyName).toBe("Anwar Hossain");
    expect(detail.body.recordCode).toBe(record.code);
  });

  it("validates items (at least one, positive amounts)", async () => {
    const { sa, record } = await setup();
    const empty = await createInvoice(sa.accessToken, record.id, { items: [] });
    expect(empty.status).toBe(400);

    const bad = await createInvoice(sa.accessToken, record.id, {
      items: [{ description: "x", unitPrice: "-5" }],
    });
    expect(bad.status).toBe(400);
  });

  it("refuses invoices against cancelled records (409) and enforces project scope", async () => {
    const { sa, record } = await setup();
    await prisma.financialRecord.update({ where: { id: record.id }, data: { status: "CANCELLED" } });
    const res = await createInvoice(sa.accessToken, record.id);
    expect(res.status).toBe(409);

    const stranger = await userContext(uniqueEmail("stranger"));
    await prisma.financialRecord.update({ where: { id: record.id }, data: { status: "ACTIVE" } });
    const denied = await createInvoice(stranger.accessToken, record.id);
    expect(denied.status).toBe(403);
  });
});

describe("receipts (POST /invoices/receipts)", () => {
  it("generates a receipt for a payment with an RCP number and auto item", async () => {
    const { sa, record } = await setup();
    const tx = await pay(sa.accessToken, record.id, "50000.25", "BK-42");

    const res = await request(app)
      .post(`${invoicesRoute}/receipts`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ transactionId: tx.id });

    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^RCP-\d{4}-\d{6}$/);
    expect(res.body.type).toBe("RECEIPT");
    expect(res.body.total).toBe("50000.25");
    expect(res.body.transactionId).toBe(tx.id);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].description).toContain(record.code);
  });

  it("refuses duplicate receipts for the same payment and receipts for void payments", async () => {
    const { sa, record } = await setup();
    const tx = await pay(sa.accessToken, record.id, "1000");

    const first = await request(app)
      .post(`${invoicesRoute}/receipts`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ transactionId: tx.id });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post(`${invoicesRoute}/receipts`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ transactionId: tx.id });
    expect(dup.status).toBe(409);

    await request(app)
      .post(`/api/v1/transactions/${tx.id}/void`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ reason: "wrong posting" });
    const tx2 = await pay(sa.accessToken, record.id, "2000");
    await request(app)
      .post(`/api/v1/transactions/${tx2.id}/void`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ reason: "wrong posting 2" });

    const voidReceipt = await request(app)
      .post(`${invoicesRoute}/receipts`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ transactionId: tx2.id });
    expect(voidReceipt.status).toBe(409);
  });
});

describe("GET /invoices (list + search)", () => {
  it("filters by type/status and searches by number/party", async () => {
    const { sa, record } = await setup();
    await createInvoice(sa.accessToken, record.id);
    const tx = await pay(sa.accessToken, record.id, "5000");
    await request(app)
      .post(`${invoicesRoute}/receipts`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ transactionId: tx.id });

    const invoicesOnly = await request(app)
      .get(invoicesRoute)
      .query({ type: "INVOICE" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(invoicesOnly.body.data).toHaveLength(1);
    expect(invoicesOnly.body.data[0].type).toBe("INVOICE");

    const receiptsOnly = await request(app)
      .get(invoicesRoute)
      .query({ type: "RECEIPT" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(receiptsOnly.body.data).toHaveLength(1);

    const byParty = await request(app)
      .get(invoicesRoute)
      .query({ search: "ANWAR" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(byParty.body.data).toHaveLength(2);
  });

  it("scopes regular users to granted projects", async () => {
    const { sa, record, project } = await setup();
    await createInvoice(sa.accessToken, record.id);
    const stranger = await userContext(uniqueEmail("stranger"));
    const denied = await request(app)
      .get(invoicesRoute)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(denied.body.data).toHaveLength(0);

    const granted = await userContext(uniqueEmail("granted"), [project.id]);
    const ok = await request(app)
      .get(invoicesRoute)
      .set("Authorization", `Bearer ${granted.accessToken}`);
    expect(ok.body.data).toHaveLength(1);
  });
});

describe("invoice PDF", () => {
  it("returns a PDF document for an invoice", async () => {
    const { sa, record } = await setup();
    const inv = await createInvoice(sa.accessToken, record.id);
    const res = await request(app)
      .get(`${invoicesRoute}/${inv.body.id}/pdf`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("returns a PDF for a receipt", async () => {
    const { sa, record } = await setup();
    const tx = await pay(sa.accessToken, record.id, "2500");
    const receipt = await request(app)
      .post(`${invoicesRoute}/receipts`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ transactionId: tx.id });
    const res = await request(app)
      .get(`${invoicesRoute}/${receipt.body.id}/pdf`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("404s for unknown invoice ids", async () => {
    const { sa } = await setup();
    const res = await request(app)
      .get(`${invoicesRoute}/ghost/pdf`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /invoices/:id/cancel", () => {
  it("cancels with reason, preserves the row, refuses re-cancellation", async () => {
    const { sa, record } = await setup();
    const inv = await createInvoice(sa.accessToken, record.id);

    const res = await request(app)
      .post(`${invoicesRoute}/${inv.body.id}/cancel`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ reason: "Issued in error" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
    expect(res.body.cancelReason).toBe("Issued in error");

    const again = await request(app)
      .post(`${invoicesRoute}/${inv.body.id}/cancel`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ reason: "again" });
    expect(again.status).toBe(409);

    const detail = await request(app)
      .get(`${invoicesRoute}/${inv.body.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(detail.body.status).toBe("CANCELLED");
    expect(detail.body.items).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({ where: { action: "INVOICE_CANCELLED" } });
    expect(audit?.entityId).toBe(inv.body.id);
  });

  it("validates reason presence", async () => {
    const { sa, record } = await setup();
    const inv = await createInvoice(sa.accessToken, record.id);
    const res = await request(app)
      .post(`${invoicesRoute}/${inv.body.id}/cancel`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
