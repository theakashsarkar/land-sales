import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeCategory, makeFinancialRecord, makeProject, resetDb, saContext, uniqueEmail, userContext } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const api = "/api/v1";

interface Fixture {
  sa: Awaited<ReturnType<typeof saContext>>;
  owner: Awaited<ReturnType<typeof userContext>>;
  stranger: Awaited<ReturnType<typeof userContext>>;
  project: Awaited<ReturnType<typeof makeProject>>;
  record: Awaited<ReturnType<typeof makeFinancialRecord>>;
  paymentId: string;
  invoiceId: string;
}

/** owner: granted on project; stranger: not granted. */
async function fixture(): Promise<Fixture> {
  const sa = await saContext();
  const project = await makeProject({ name: "Secret Project", code: "SEC" });
  const category = await makeCategory({ name: "Secret Cat" });
  const record = await makeFinancialRecord({
    projectId: project.id,
    categoryId: category.id,
    totalAmount: "200000",
    actorId: sa.user.id,
  });
  const owner = await userContext(uniqueEmail("owner"), [project.id]);
  const stranger = await userContext(uniqueEmail("stranger"));

  const pay = await request(app)
    .post(`${api}/financial-records/${record.id}/payments`)
    .set("Authorization", `Bearer ${owner.accessToken}`)
    .send({ amount: "10000", reference: "SEC-1" });
  expect(pay.status).toBe(201);

  const inv = await request(app)
    .post(`${api}/invoices`)
    .set("Authorization", `Bearer ${sa.accessToken}`)
    .send({
      financialRecordId: record.id,
      items: [{ description: "Demand", quantity: 1, unitPrice: "50000" }],
    });
  expect(inv.status).toBe(201);

  return {
    sa,
    owner,
    stranger,
    project,
    record,
    paymentId: pay.body.transaction.id as string,
    invoiceId: inv.body.id as string,
  };
}

describe("IDOR / cross-user isolation", () => {
  it("stranger cannot read the record, its transactions, history, or invoices", async () => {
    const { stranger, record, invoiceId } = await fixture();

    const detail = await request(app)
      .get(`${api}/financial-records/${record.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(detail.status).toBe(403);

    const txs = await request(app)
      .get(`${api}/financial-records/${record.id}/transactions`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(txs.status).toBe(403);

    const history = await request(app)
      .get(`${api}/financial-records/${record.id}/history`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(history.status).toBe(403);

    const invoice = await request(app)
      .get(`${api}/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(invoice.status).toBe(403);

    const invoicePdf = await request(app)
      .get(`${api}/invoices/${invoiceId}/pdf`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(invoicePdf.status).toBe(403);
  });

  it("stranger cannot pay, update, cancel or void anything on another project", async () => {
    const { stranger, record, paymentId } = await fixture();

    const pay = await request(app)
      .post(`${api}/financial-records/${record.id}/payments`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ amount: "1" });
    expect(pay.status).toBe(403);

    const patch = await request(app)
      .patch(`${api}/financial-records/${record.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ totalAmount: "1" });
    expect(patch.status).toBe(403);

    const cancel = await request(app)
      .patch(`${api}/financial-records/${record.id}/status`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ status: "CANCELLED" });
    expect(cancel.status).toBe(403);

    const voidTx = await request(app)
      .post(`${api}/transactions/${paymentId}/void`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ reason: "hostile void" });
    expect(voidTx.status).toBe(403);

    const voidAgain = await prisma.transaction.findUnique({ where: { id: paymentId } });
    expect(voidAgain?.status).toBe("VALID");
  });

  it("list endpoints never leak other projects' rows", async () => {
    const { stranger, record } = await fixture();

    const records = await request(app)
      .get(`${api}/financial-records`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(records.body.data.every((r: { id: string }) => r.id !== record.id)).toBe(true);

    const txs = await request(app)
      .get(`${api}/transactions`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(txs.body.data).toHaveLength(0);

    const invoices = await request(app)
      .get(`${api}/invoices`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(invoices.body.data).toHaveLength(0);

    const txReport = await request(app)
      .get(`${api}/reports/transactions`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(txReport.body.rows).toHaveLength(0);
  });

  it("filtering by another record's id cannot bypass the scope", async () => {
    const { stranger, record, paymentId } = await fixture();
    const res = await request(app)
      .get(`${api}/transactions`)
      .query({ financialRecordId: record.id })
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { id: string }) => t.id !== paymentId)).toBe(true);
  });
});

describe("authorization matrix", () => {
  it("regular users are refused on all admin-only endpoints", async () => {
    const { stranger, record } = await fixture();
    const target = await (async () => {
      const u = await prisma.user.create({
        data: { name: "Target", email: uniqueEmail("target"), passwordHash: "x", role: "USER" },
      });
      return u;
    })();

    const checks: Promise<request.Response>[] = [
      request(app).get(`${api}/users`).set("Authorization", `Bearer ${stranger.accessToken}`),
      request(app)
        .post(`${api}/users`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ name: "X", email: uniqueEmail(), password: "Password123!" }),
      request(app)
        .patch(`${api}/users/${target.id}`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ name: "Y" }),
      request(app)
        .patch(`${api}/users/${target.id}/status`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ isActive: false }),
      request(app)
        .patch(`${api}/users/${target.id}/password`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ password: "Password123!" }),
      request(app).get(`${api}/users/dropdown`).set("Authorization", `Bearer ${stranger.accessToken}`),
      request(app)
        .post(`${api}/projects`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ name: "X", code: "XX1" }),
      request(app)
        .patch(`${api}/projects/${record.projectId}/status`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ isActive: false }),
      request(app).get(`${api}/projects/${record.projectId}/users`).set("Authorization", `Bearer ${stranger.accessToken}`),
      request(app)
        .post(`${api}/categories`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ name: "X" }),
      request(app)
        .patch(`${api}/financial-records/${record.id}`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ title: "X" }),
    ];

    const responses = await Promise.all(checks);
    for (const res of responses) {
      expect([401, 403]).toContain(res.status);
    }
  });

  it("unauthenticated requests are refused everywhere", async () => {
    const endpoints = [
      `${api}/users`,
      `${api}/projects`,
      `${api}/categories`,
      `${api}/financial-records`,
      `${api}/transactions`,
      `${api}/invoices`,
      `${api}/dashboard`,
      `${api}/reports/date-wise`,
      `${api}/auth/me`,
    ];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
    }
  });
});

describe("input trust boundaries", () => {
  it("ignores client-supplied ids: the session user is the actor", async () => {
    const { sa, owner, record } = await fixture();
    // Try to make it look like the stranger created the record by passing
    // bogus fields — strict schemas reject unknown keys outright.
    const hostile = await request(app)
      .post(`${api}/financial-records`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Try",
        partyName: "Try",
        projectId: record.projectId,
        categoryId: (await prisma.category.findFirst())!.id,
        totalAmount: "100",
        createdById: sa.user.id,
        status: "CANCELLED",
        code: "FORGED-01",
      });
    expect([400, 403, 201]).toContain(hostile.status);
    if (hostile.status === 201) {
      const row = await prisma.financialRecord.findUnique({ where: { id: hostile.body.id } });
      expect(row!.createdById).toBe(owner.user.id); // server-assigned, not client
      expect(row!.status).toBe("ACTIVE"); // not client-controlled
    }
  });

  it("never exposes password hashes in any response", async () => {
    const { sa, owner } = await fixture();

    const me = await request(app).get(`${api}/auth/me`).set("Authorization", `Bearer ${owner.accessToken}`);
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");

    const list = await request(app).get(`${api}/users`).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(JSON.stringify(list.body)).not.toContain("passwordHash");

    const login = await request(app).post(`${api}/auth/login`).send({
      email: owner.user.email,
      password: "Password123!",
    });
    expect(JSON.stringify(login.body)).not.toContain("passwordHash");
  });

  it("strict schemas reject unknown body fields", async () => {
    const { sa } = await fixture();
    const res = await request(app)
      .post(`${api}/projects`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "Ok", code: "OK1", evilField: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("audit trail completeness", () => {
  it("records audit entries for the full lifecycle", async () => {
    const { sa, owner, record, paymentId, invoiceId } = await fixture();

    // fixture seeds rows directly via prisma (no audit by design) — create
    // one record through the API so its creation audit exists too.
    const apiRecord = await request(app)
      .post(`${api}/financial-records`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({
        title: "Audited record",
        partyName: "Audited Party",
        projectId: record.projectId,
        categoryId: (await prisma.category.findFirst())!.id,
        totalAmount: "1000",
      });
    expect(apiRecord.status).toBe(201);

    await request(app)
      .patch(`${api}/financial-records/${record.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ totalAmount: "210000" });
    await request(app)
      .post(`${api}/transactions/${paymentId}/void`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ reason: "audit test void" });
    await request(app)
      .post(`${api}/invoices/${invoiceId}/cancel`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ reason: "audit test cancel" });

    const actions = (await prisma.auditLog.findMany()).map((a) => a.action);
    for (const expected of [
      "AUTH_LOGIN",
      "FINANCIAL_RECORD_CREATED",
      "FINANCIAL_RECORD_UPDATED",
      "TRANSACTION_RECORDED",
      "TRANSACTION_VOIDED",
      "INVOICE_CREATED",
      "INVOICE_CANCELLED",
    ]) {
      expect(actions, `missing audit action ${expected}`).toContain(expected);
    }

    const voidHistory = await prisma.recordHistory.findFirst({
      where: { entityType: "Transaction", entityId: paymentId, action: "VOIDED" },
    });
    expect(voidHistory).toMatchObject({ oldValue: "VALID", newValue: "VOID" });

    // previous + updated values preserved for the amount change (2dp canonical)
    const amountHistory = await prisma.recordHistory.findFirst({
      where: { entityType: "FinancialRecord", entityId: record.id, field: "totalAmount", action: "UPDATED" },
    });
    expect(amountHistory).toMatchObject({ oldValue: "200000.00", newValue: "210000.00" });
  });
});
