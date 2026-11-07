import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeCategory, makeFinancialRecord, makeProject, resetDb, saContext, uniqueEmail, userContext } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const route = "/api/v1/dashboard";

async function pay(token: string, recordId: string, amount: string, opts: { void?: boolean } = {}) {
  const res = await request(app)
    .post(`/api/v1/financial-records/${recordId}/payments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount, method: "CASH" });
  expect(res.status).toBe(201);
  if (opts.void) {
    const v = await request(app)
      .post(`/api/v1/transactions/${res.body.transaction.id}/void`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "test void" });
    expect(v.status).toBe(200);
  }
  return res.body.transaction;
}

describe("GET /dashboard (super admin)", () => {
  it("returns system-wide counts, financial totals, recent transactions and summaries", async () => {
    const sa = await saContext();
    await createUserRows();

    const projectA = await makeProject({ name: "Project A", code: "PA" });
    const projectB = await makeProject({ name: "Project B", code: "PB" });
    const catA = await makeCategory({ name: "Cat A" });
    const catB = await makeCategory({ name: "Cat B" });

    const recA = await makeFinancialRecord({
      projectId: projectA.id,
      categoryId: catA.id,
      totalAmount: "100000",
      actorId: sa.user.id,
    });
    const recB = await makeFinancialRecord({
      projectId: projectB.id,
      categoryId: catB.id,
      totalAmount: "50000.50",
      actorId: sa.user.id,
    });
    // cancelled record: excluded from financial totals
    await makeFinancialRecord({
      projectId: projectA.id,
      categoryId: catA.id,
      totalAmount: "999999",
      status: "CANCELLED",
      actorId: sa.user.id,
    });

    await pay(sa.accessToken, recA.id, "25000");
    await pay(sa.accessToken, recA.id, "15000");
    await pay(sa.accessToken, recA.id, "50000", { void: true });

    const res = await request(app).get(route).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("SUPER_ADMIN");

    expect(res.body.counts.users).toEqual({ total: 3, active: 2 }); // sa + 2 created (one inactive)
    expect(res.body.counts.projects).toEqual({ total: 2, active: 2 });
    expect(res.body.counts.categories).toEqual({ total: 2, active: 2 });

    expect(res.body.financial.totalAmount).toBe("150000.50");
    expect(res.body.financial.totalPaidAmount).toBe("40000.00"); // VOID excluded
    expect(res.body.financial.totalRemainingAmount).toBe("110000.50");
    expect(res.body.financial.activeRecordCount).toBe(2);

    const projA = res.body.projectSummaries.find((p: { project: { code: string } }) => p.project.code === "PA");
    const projB = res.body.projectSummaries.find((p: { project: { code: string } }) => p.project.code === "PB");
    expect(projA.recordCount).toBe(1); // cancelled record excluded
    expect(projA.totalAmount).toBe("100000.00");
    expect(projB.totalAmount).toBe("50000.50");

    expect(res.body.categorySummaries).toHaveLength(2);
    expect(res.body.recentTransactions.length).toBeGreaterThan(0);
    expect(res.body.recentTransactions[0]).toHaveProperty("financialRecord");
    expect(res.body.recentTransactions[0]).toHaveProperty("createdBy");
  });

  it("project summaries exclude cancelled records from totals", async () => {
    const sa = await saContext();
    const projectA = await makeProject({ name: "Project A", code: "PA" });
    const catA = await makeCategory({ name: "Cat A" });
    const recA = await makeFinancialRecord({
      projectId: projectA.id,
      categoryId: catA.id,
      totalAmount: "100000",
      actorId: sa.user.id,
    });
    await makeFinancialRecord({
      projectId: projectA.id,
      categoryId: catA.id,
      totalAmount: "999999",
      status: "CANCELLED",
      actorId: sa.user.id,
    });
    await pay(sa.accessToken, recA.id, "10000");

    const res = await request(app).get(route).set("Authorization", `Bearer ${sa.accessToken}`);
    const projA = res.body.projectSummaries.find((p: { project: { code: string } }) => p.project.code === "PA");
    expect(projA.recordCount).toBe(1); // active only
    expect(projA.totalAmount).toBe("100000.00");
    expect(projA.paidAmount).toBe("10000.00");
    expect(projA.remainingAmount).toBe("90000.00");

    const catSum = res.body.categorySummaries.find((c: { category: { name: string } }) => c.category.name === "Cat A");
    expect(catSum.totalAmount).toBe("100000.00");
  });
});

describe("GET /dashboard (regular user)", () => {
  it("scopes all numbers to the user's assigned projects and hides admin counts", async () => {
    const sa = await saContext();
    const projectA = await makeProject({ name: "Project A", code: "PA" });
    const projectB = await makeProject({ name: "Project B", code: "PB" });
    const catA = await makeCategory({ name: "Cat A" });
    const catB = await makeCategory({ name: "Cat B" });

    const recA = await makeFinancialRecord({ projectId: projectA.id, categoryId: catA.id, totalAmount: "100000", actorId: sa.user.id });
    const recB = await makeFinancialRecord({ projectId: projectB.id, categoryId: catB.id, totalAmount: "50000", actorId: sa.user.id });
    await pay(sa.accessToken, recA.id, "40000");
    await pay(sa.accessToken, recB.id, "5000");

    const user = await userContext(uniqueEmail("dash"), [projectA.id]);
    const res = await request(app).get(route).set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("USER");

    expect(res.body.counts.users).toBeNull();
    expect(res.body.counts.projects).toEqual({ total: 1, active: 1 }); // only assigned
    expect(res.body.financial.totalAmount).toBe("100000.00");
    expect(res.body.financial.totalPaidAmount).toBe("40000.00");
    expect(res.body.financial.totalRemainingAmount).toBe("60000.00");

    expect(res.body.projectSummaries).toHaveLength(1);
    expect(res.body.projectSummaries[0].project.code).toBe("PA");

    const categoryNames = res.body.categorySummaries.map((c: { category: { name: string } }) => c.category.name);
    expect(categoryNames).toEqual(["Cat A"]); // Cat B has no visible records

    for (const t of res.body.recentTransactions) {
      expect(t.financialRecord.projectId).toBe(projectA.id);
    }
  });
});

describe("GET /dashboard auth", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(route);
    expect(res.status).toBe(401);
  });
});

async function createUserRows() {
  await prisma.user.create({
    data: { name: "Extra User", email: uniqueEmail("extra"), passwordHash: "x", role: "USER" },
  });
  await prisma.user.create({
    data: { name: "Inactive User", email: uniqueEmail("inactive"), passwordHash: "x", role: "USER", isActive: false },
  });
}
