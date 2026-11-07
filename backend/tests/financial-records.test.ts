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

const route = "/api/v1/financial-records";
const txRoute = "/api/v1/transactions";

interface Ctx {
  sa: { accessToken: string; user: { id: string } };
  project: { id: string };
  category: { id: string };
}

async function baseCtx(): Promise<Ctx> {
  const sa = await saContext();
  const project = await makeProject();
  const category = await makeCategory();
  return { sa, project, category };
}

const createPayload = (ctx: Ctx, overrides: Record<string, unknown> = {}) => ({
  title: "Plot sale — GV-A-014",
  partyName: "Rahim Uddin",
  partyPhone: "+8801711111111",
  projectId: ctx.project.id,
  categoryId: ctx.category.id,
  totalAmount: "150000.50",
  description: "5 katha south-facing plot",
  ...overrides,
});

describe("POST /financial-records", () => {
  it("creates a record with sequential FIN code, decimal amount, history + audit", async () => {
    const ctx = await baseCtx();
    const res1 = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(createPayload(ctx));
    const res2 = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(createPayload(ctx, { title: "Second" }));

    expect(res1.status).toBe(201);
    expect(res1.body.totalAmount).toBe("150000.50");
    expect(res1.body.status).toBe("ACTIVE");
    expect(res1.body.code).toMatch(/^FIN-\d{4}-\d{6}$/);
    expect(res2.body.code).not.toBe(res1.body.code);
    const n1 = Number(res1.body.code.slice(-6));
    const n2 = Number(res2.body.code.slice(-6));
    expect(n2).toBe(n1 + 1);

    const history = await prisma.recordHistory.findFirst({
      where: { entityType: "FinancialRecord", entityId: res1.body.id },
    });
    expect(history?.action).toBe("CREATED");

    const audit = await prisma.auditLog.findFirst({ where: { action: "FINANCIAL_RECORD_CREATED" } });
    expect(audit?.entityId).toBe(res1.body.id);
  });

  it("rejects invalid amounts (negative, zero, non-numeric, >2dp rounds half-up)", async () => {
    const ctx = await baseCtx();
    for (const amount of ["-5", "0", "abc"]) {
      const res = await request(app)
        .post(route)
        .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
        .send(createPayload(ctx, { totalAmount: amount }));
      expect(res.status).toBe(400);
    }
    // "1000.567" is accepted but normalized to 2dp half-up -> 1000.57
    const res = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(createPayload(ctx, { totalAmount: "1000.567" }));
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe("1000.57");
  });

  it("rejects inactive or nonexistent project/category", async () => {
    const ctx = await baseCtx();
    await prisma.project.update({ where: { id: ctx.project.id }, data: { isActive: false } });

    const res = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(createPayload(ctx));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/project/i);

    const res2 = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(createPayload(ctx, { categoryId: "ghost" }));
    expect(res2.status).toBe(400);
  });

  it("regular user can create only in granted projects (403 otherwise)", async () => {
    const ctx = await baseCtx();
    const granted = await userContext(uniqueEmail("granted"), [ctx.project.id]);
    const stranger = await userContext(uniqueEmail("stranger"));

    const ok = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${granted.accessToken}`)
      .send(createPayload(ctx));
    expect(ok.status).toBe(201);

    const denied = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send(createPayload(ctx));
    expect(denied.status).toBe(403);
  });
});

describe("GET /financial-records (list)", () => {
  it("filters by project, category, status, search and date range with pagination", async () => {
    const ctx = await baseCtx();
    const otherProject = await makeProject();
    const otherCategory = await makeCategory();

    const jan = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      title: "Alpha sale",
      partyName: "Anwar",
      createdAt: new Date("2026-01-10T00:00:00Z"),
      actorId: ctx.sa.user.id,
    });
    const feb = await makeFinancialRecord({
      projectId: otherProject.id,
      categoryId: otherCategory.id,
      title: "Beta sale",
      partyName: "Babul",
      status: "CANCELLED",
      createdAt: new Date("2026-02-10T00:00:00Z"),
      actorId: ctx.sa.user.id,
    });

    const byProject = await request(app)
      .get(route)
      .query({ projectId: ctx.project.id })
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(byProject.body.data.map((r: { id: string }) => r.id)).toEqual([jan.id]);

    const byStatus = await request(app)
      .get(route)
      .query({ status: "CANCELLED" })
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(byStatus.body.data.map((r: { id: string }) => r.id)).toEqual([feb.id]);

    const bySearch = await request(app)
      .get(route)
      .query({ search: "BABUL" })
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(bySearch.body.data).toHaveLength(1);

    const byDate = await request(app)
      .get(route)
      .query({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(byDate.body.data).toHaveLength(1);

    const paged = await request(app)
      .get(route)
      .query({ page: 2, pageSize: 1 })
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toMatchObject({ page: 2, pageSize: 1, total: 2 });
  });

  it("scopes regular users to granted projects only", async () => {
    const ctx = await baseCtx();
    await makeFinancialRecord({ projectId: ctx.project.id, categoryId: ctx.category.id, actorId: ctx.sa.user.id });
    const granted = await userContext(uniqueEmail("scoped"), [ctx.project.id]);

    const res = await request(app)
      .get(route)
      .set("Authorization", `Bearer ${granted.accessToken}`);
    expect(res.body.data).toHaveLength(1);

    // Explicitly requesting an ungranted project is refused.
    const otherProject = await makeProject();
    await makeFinancialRecord({ projectId: otherProject.id, categoryId: ctx.category.id, actorId: ctx.sa.user.id });
    const denied = await request(app)
      .get(route)
      .query({ projectId: otherProject.id })
      .set("Authorization", `Bearer ${granted.accessToken}`);
    expect(denied.status).toBe(403);
  });
});

describe("GET /financial-records/:id", () => {
  it("returns the record with paid/remaining balance", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      totalAmount: "150000.50",
      actorId: ctx.sa.user.id,
    });
    const user = await userContext(uniqueEmail("payer"), [ctx.project.id]);
    await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ amount: "50000.25", method: "CASH" });
    await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ amount: "40000.25", method: "BANK", reference: "BK-1" });

    const res = await request(app)
      .get(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe("150000.50");
    expect(res.body.paidAmount).toBe("90000.50");
    expect(res.body.remainingAmount).toBe("60000.00");
    expect(res.body.paymentCount).toBe(2);
    expect(res.body.project.id).toBe(ctx.project.id);
    expect(res.body.category.id).toBe(ctx.category.id);
    expect(res.body.createdBy.id).toBe(ctx.sa.user.id);
  });

  it("403s for a user without project access (IDOR guard)", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    const stranger = await userContext(uniqueEmail("stranger"));
    const res = await request(app)
      .get(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("404s for unknown id", async () => {
    const ctx = await baseCtx();
    const res = await request(app)
      .get(`${route}/ghost-id`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /financial-records/:id", () => {
  it("updates fields with per-field history (old/new values, decimal strings)", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      totalAmount: "100000",
      title: "Original",
      partyName: "Original Party",
      actorId: ctx.sa.user.id,
    });

    const res = await request(app)
      .patch(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ title: "Renamed", totalAmount: "120000.75", partyName: "Renamed Party" });
    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe("120000.75");

    const changes = await prisma.recordHistory.findMany({
      where: { entityType: "FinancialRecord", entityId: record.id, action: "UPDATED" },
    });
    const byField = Object.fromEntries(changes.map((c) => [c.field, c]));
    expect(byField["totalAmount"]).toMatchObject({ oldValue: "100000.00", newValue: "120000.75" });
    expect(byField["title"]).toMatchObject({ oldValue: "Original", newValue: "Renamed" });
    expect(byField["partyName"]).toMatchObject({ oldValue: "Original Party", newValue: "Renamed Party" });
  });

  it("blocks updates to cancelled records", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      status: "CANCELLED",
      actorId: ctx.sa.user.id,
    });
    const res = await request(app)
      .patch(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ title: "Nope" });
    expect(res.status).toBe(409);
  });

  it("rejects invalid amounts and ungranted users", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });

    const badAmount = await request(app)
      .patch(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ totalAmount: "-1" });
    expect(badAmount.status).toBe(400);

    const stranger = await userContext(uniqueEmail("stranger"));
    const denied = await request(app)
      .patch(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ title: "Hack" });
    expect(denied.status).toBe(403);
  });
});

describe("PATCH /financial-records/:id/status", () => {
  it("cancels a record (payments then refused) and reactivates it", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });

    const cancel = await request(app)
      .patch(`${route}/${record.id}/status`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("CANCELLED");

    const pay = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "100" });
    expect(pay.status).toBe(409);

    const reactivate = await request(app)
      .patch(`${route}/${record.id}/status`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ status: "ACTIVE" });
    expect(reactivate.body.status).toBe("ACTIVE");

    const h = await prisma.recordHistory.findMany({
      where: { entityType: "FinancialRecord", entityId: record.id, action: "STATUS_CHANGED" },
    });
    expect(h).toHaveLength(2);
  });

  it("validates status values", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    const res = await request(app)
      .patch(`${route}/${record.id}/status`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ status: "DELETED" });
    expect(res.status).toBe(400);
  });
});

describe("payments (POST /:id/payments)", () => {
  it("records a payment with exact decimals and returns updated balance", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      totalAmount: "150000.50",
      actorId: ctx.sa.user.id,
    });
    const user = await userContext(uniqueEmail("payer"), [ctx.project.id]);

    const res = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ amount: "50000.25", method: "BANK", reference: "TX-99", paidAt: "2026-03-05", note: "First installment" });

    expect(res.status).toBe(201);
    expect(res.body.transaction.amount).toBe("50000.25");
    expect(res.body.transaction.status).toBe("VALID");
    expect(res.body.transaction.method).toBe("BANK");
    expect(res.body.recordSummary.paidAmount).toBe("50000.25");
    expect(res.body.recordSummary.remainingAmount).toBe("100000.25");
  });

  it("prevents duplicate transactions via per-record reference (409)", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    const body = { amount: "1000", reference: "RCPT-77" };
    const first = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(body);
    expect(first.status).toBe(201);

    const retry = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send(body);
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe("DUPLICATE_REFERENCE");

    const count = await prisma.transaction.count({ where: { financialRecordId: record.id } });
    expect(count).toBe(1);
  });

  it("rejects invalid amounts and payments against cancelled records", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    const bad = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "0" });
    expect(bad.status).toBe(400);

    const neg = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "-10" });
    expect(neg.status).toBe(400);

    await prisma.financialRecord.update({ where: { id: record.id }, data: { status: "CANCELLED" } });
    const cancelled = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "10" });
    expect(cancelled.status).toBe(409);
  });

  it("denies ungranted users (IDOR guard) and writes PAYMENT_RECORDED history", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    const stranger = await userContext(uniqueEmail("stranger"));
    const denied = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ amount: "100" });
    expect(denied.status).toBe(403);

    const h = await prisma.recordHistory.findFirst({
      where: { entityType: "Transaction", action: "PAYMENT_RECORDED" },
    });
    expect(h).toBeNull();

    const granted = await userContext(uniqueEmail("granted"), [ctx.project.id]);
    await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${granted.accessToken}`)
      .send({ amount: "100" });
    const history = await prisma.recordHistory.findFirst({
      where: { entityType: "Transaction", action: "PAYMENT_RECORDED" },
    });
    expect(history).toBeTruthy();
    expect(history?.actorId).toBe(granted.user.id);
  });
});

describe("GET /:id/transactions + GET /transactions", () => {
  it("lists a record's payments newest-first", async () => {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "100", paidAt: "2026-01-05" });
    await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "200", paidAt: "2026-02-05" });

    const res = await request(app)
      .get(`${route}/${record.id}/transactions`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].amount).toBe("200.00");
  });

  it("global transaction list: filters + scoping", async () => {
    const ctx = await baseCtx();
    const r1 = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    const otherProject = await makeProject();
    const r2 = await makeFinancialRecord({
      projectId: otherProject.id,
      categoryId: ctx.category.id,
      actorId: ctx.sa.user.id,
    });
    await request(app)
      .post(`${route}/${r1.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "100", method: "CASH" });
    await request(app)
      .post(`${route}/${r2.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "500", method: "ONLINE" });

    const sa = ctx.sa;
    const byMethod = await request(app)
      .get(txRoute)
      .query({ method: "ONLINE" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(byMethod.body.data).toHaveLength(1);
    expect(byMethod.body.data[0].amount).toBe("500.00");

    const granted = await userContext(uniqueEmail("scoped"), [ctx.project.id]);
    const scoped = await request(app).get(txRoute).set("Authorization", `Bearer ${granted.accessToken}`);
    expect(scoped.body.data).toHaveLength(1);
    expect(scoped.body.data[0].amount).toBe("100.00");

    const unauth = await request(app).get(txRoute);
    expect(unauth.status).toBe(401);
  });
});

describe("POST /transactions/:id/void", () => {
  async function withPayment() {
    const ctx = await baseCtx();
    const record = await makeFinancialRecord({
      projectId: ctx.project.id,
      categoryId: ctx.category.id,
      totalAmount: "100000",
      actorId: ctx.sa.user.id,
    });
    const pay = await request(app)
      .post(`${route}/${record.id}/payments`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ amount: "40000.25" });
    return { ctx, record, txId: pay.body.transaction.id as string };
  }

  it("voids a payment (never deletes), requires a reason, and updates the balance", async () => {
    const { ctx, record, txId } = await withPayment();

    const noReason = await request(app)
      .post(`${txRoute}/${txId}/void`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({});
    expect(noReason.status).toBe(400);

    const res = await request(app)
      .post(`${txRoute}/${txId}/void`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ reason: "Duplicate bank posting" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("VOID");
    expect(res.body.voidReason).toBe("Duplicate bank posting");
    expect(res.body.voidedById).toBe(ctx.sa.user.id);

    // Historical row preserved — not deleted.
    const stillThere = await prisma.transaction.findUnique({ where: { id: txId } });
    expect(stillThere).toBeTruthy();
    expect(stillThere!.status).toBe("VOID");

    const detail = await request(app)
      .get(`${route}/${record.id}`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`);
    expect(detail.body.paidAmount).toBe("0.00");
    expect(detail.body.remainingAmount).toBe("100000.00");

    const h = await prisma.recordHistory.findFirst({
      where: { entityType: "Transaction", entityId: txId, action: "VOIDED" },
    });
    expect(h?.oldValue).toBe("VALID");
    expect(h?.newValue).toBe("VOID");

    const audit = await prisma.auditLog.findFirst({ where: { action: "TRANSACTION_VOIDED" } });
    expect(audit?.entityId).toBe(txId);
  });

  it("refuses double-voiding and unknown ids", async () => {
    const { ctx, txId } = await withPayment();
    await request(app)
      .post(`${txRoute}/${txId}/void`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ reason: "first void" });
    const twice = await request(app)
      .post(`${txRoute}/${txId}/void`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ reason: "voiding again" });
    expect(twice.status).toBe(409);

    const missing = await request(app)
      .post(`${txRoute}/ghost/void`)
      .set("Authorization", `Bearer ${ctx.sa.accessToken}`)
      .send({ reason: "unknown transaction" });
    expect(missing.status).toBe(404);
  });

  it("enforces project scope on void", async () => {
    const { ctx, txId } = await withPayment();
    const stranger = await userContext(uniqueEmail("stranger"));
    const denied = await request(app)
      .post(`${txRoute}/${txId}/void`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .send({ reason: "hack" });
    expect(denied.status).toBe(403);
  });
});
