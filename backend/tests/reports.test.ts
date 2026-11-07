import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeCategory, makeFinancialRecord, makeProject, resetDb, saContext, uniqueEmail, userContext } from "./helpers.js";

beforeEach(resetDb);

const route = "/api/v1/reports";

interface Seed {
  sa: Awaited<ReturnType<typeof saContext>>;
  user: Awaited<ReturnType<typeof userContext>>;
  projectA: Awaited<ReturnType<typeof makeProject>>;
  projectB: Awaited<ReturnType<typeof makeProject>>;
  catA: Awaited<ReturnType<typeof makeCategory>>;
  catB: Awaited<ReturnType<typeof makeCategory>>;
  recA: Awaited<ReturnType<typeof makeFinancialRecord>>;
  recB: Awaited<ReturnType<typeof makeFinancialRecord>>;
}

async function seed(): Promise<Seed> {
  const sa = await saContext();
  const projectA = await makeProject({ name: "Alpha Project", code: "ALP" });
  const projectB = await makeProject({ name: "Beta Project", code: "BET" });
  const catA = await makeCategory({ name: "Plot Sale" });
  const catB = await makeCategory({ name: "Installment" });
  const recA = await makeFinancialRecord({
    projectId: projectA.id,
    categoryId: catA.id,
    totalAmount: "100000",
    actorId: sa.user.id,
  });
  const recB = await makeFinancialRecord({
    projectId: projectB.id,
    categoryId: catB.id,
    totalAmount: "60000",
    actorId: sa.user.id,
  });

  const user = await userContext(uniqueEmail("reportuser"), [projectA.id]);

  // Payments: A gets 10k (Jan 5) + 15k (Jan 20) by SA, 5k voided (Feb 1) by user;
  // B gets 20k (Jan 10) by user.
  const pay = async (token: string, recordId: string, amount: string, paidAt: string) => {
    const res = await request(app)
      .post(`/api/v1/financial-records/${recordId}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount, paidAt, method: "BANK" });
    expect(res.status).toBe(201);
    return res.body.transaction as { id: string };
  };

  await pay(sa.accessToken, recA.id, "10000", "2026-01-05");
  await pay(sa.accessToken, recA.id, "15000", "2026-01-20");
  await pay(sa.accessToken, recB.id, "20000", "2026-01-10");
  const voided = await pay(user.accessToken, recA.id, "5000", "2026-02-01");
  const v = await request(app)
    .post(`/api/v1/transactions/${voided.id}/void`)
    .set("Authorization", `Bearer ${sa.accessToken}`)
    .send({ reason: "test void" });
  expect(v.status).toBe(200);
  // one valid March payment recorded by the regular user
  await pay(user.accessToken, recA.id, "2000", "2026-03-01");

  return { sa, user, projectA, projectB, catA, catB, recA, recB };
}


describe("date-wise report", () => {
  it("groups valid payments by day, honoring date filters and excluding voids", async () => {
    const { sa } = await seed();
    const res = await request(app)
      .get(`${route}/date-wise`)
      .query({ from: "2026-01-01", to: "2026-01-31" })
      .set("Authorization", `Bearer ${sa.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.format).toBe("json");
    expect(res.body.rows).toEqual([
      { date: "2026-01-05", transactionCount: 1, total: "10000.00" },
      { date: "2026-01-10", transactionCount: 1, total: "20000.00" },
      { date: "2026-01-20", transactionCount: 1, total: "15000.00" },
    ]);
  });
});

describe("user-wise report", () => {
  it("groups by the user who recorded the payment", async () => {
    const { sa, user } = await seed();
    const res = await request(app)
      .get(`${route}/user-wise`)
      .set("Authorization", `Bearer ${sa.accessToken}`);

    expect(res.status).toBe(200);
    const byUser = res.body.rows as { user: { id: string }; transactionCount: number; total: string }[];
    const saRow = byUser.find((r) => r.user.id === sa.user.id);
    const userRow = byUser.find((r) => r.user.id === user.user.id);
    expect(saRow).toMatchObject({ transactionCount: 3, total: "45000.00" });
    expect(userRow).toMatchObject({ transactionCount: 1, total: "2000.00" }); // voided payment excluded
  });
});

describe("project-wise + category-wise reports", () => {
  it("summarizes per project", async () => {
    const { sa, projectA, projectB } = await seed();
    const res = await request(app)
      .get(`${route}/project-wise`)
      .set("Authorization", `Bearer ${sa.accessToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.rows as {
      project: { code: string };
      recordCount: number;
      totalAmount: string;
      paidAmount: string;
      remainingAmount: string;
    }[];
    const a = rows.find((r) => r.project.code === projectA.code)!;
    const b = rows.find((r) => r.project.code === projectB.code)!;
    expect(a).toMatchObject({ recordCount: 1, totalAmount: "100000.00", paidAmount: "27000.00", remainingAmount: "73000.00" });
    expect(b).toMatchObject({ recordCount: 1, totalAmount: "60000.00", paidAmount: "20000.00", remainingAmount: "40000.00" });
  });

  it("summarizes per category", async () => {
    const { sa, catA } = await seed();
    const res = await request(app)
      .get(`${route}/category-wise`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    const row = res.body.rows.find((r: { category: { id: string } }) => r.category.id === catA.id);
    expect(row).toMatchObject({ totalAmount: "100000.00", paidAmount: "27000.00" });
  });
});

describe("financial summary report", () => {
  it("returns totals plus a per-method breakdown", async () => {
    const { sa, recA } = await seed();
    // one CASH payment on A
    const cashPayment = await request(app)
      .post(`/api/v1/financial-records/${recA.id}/payments`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ amount: "1000", method: "CASH" });
    expect(cashPayment.status).toBe(201);

    const res = await request(app)
      .get(`${route}/financial-summary`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totals.totalAmount).toBe("160000.00");
    expect(res.body.totals.totalPaidAmount).toBe("48000.00");
    expect(res.body.totals.totalRemainingAmount).toBe("112000.00");
    const bank = res.body.byMethod.find((m: { method: string }) => m.method === "BANK");
    const cash = res.body.byMethod.find((m: { method: string }) => m.method === "CASH");
    expect(bank.total).toBe("47000.00");
    expect(cash.total).toBe("1000.00");
  });
});

describe("transaction history report", () => {
  it("lists filtered transactions with pagination", async () => {
    const { sa } = await seed();
    const res = await request(app)
      .get(`${route}/transactions`)
      .query({ from: "2026-01-01", to: "2026-01-31", page: 1, pageSize: 2 })
      .set("Authorization", `Bearer ${sa.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(res.body.rows.every((r: { status: string }) => r.status === "VALID")).toBe(true);
  });

  it("scopes regular users to assigned projects", async () => {
    const { user, projectA } = await seed();
    const res = await request(app)
      .get(`${route}/transactions`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    // only project A payments are visible (3 valid: 10000, 15000 by SA + 2000 by user)
    expect(res.body.rows).toHaveLength(3);
    expect(res.body.rows.every((r: { financialRecord: { projectId: string } }) => r.financialRecord.projectId === projectA.id)).toBe(true);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBinary(): any {
  return (res: request.Response, cb: (err: Error | null, data?: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  };
}

describe("exports (pdf / xlsx)", () => {
  it("date-wise PDF export returns a PDF document", async () => {
    const { sa } = await seed();
    const res = await request(app)
      .get(`${route}/date-wise`)
      .query({ format: "pdf" })
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .buffer(true)
      .parse(collectBinary());
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("project-wise XLSX export returns an Excel workbook", async () => {
    const { sa } = await seed();
    const res = await request(app)
      .get(`${route}/project-wise`)
      .query({ format: "xlsx" })
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .buffer(true)
      .parse(collectBinary());
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe("PK"); // zip magic
  });

  it("transactions XLSX export works", async () => {
    const { sa } = await seed();
    const res = await request(app)
      .get(`${route}/transactions`)
      .query({ format: "xlsx" })
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .buffer(true)
      .parse(collectBinary());
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.status).toBe(200);
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe("PK");
  });
});

describe("report scoping + auth", () => {
  it("user-wise report is scoped for regular users", async () => {
    const { user, sa } = await seed();
    const res = await request(app)
      .get(`${route}/user-wise`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    // visible payments on project A: two by SA (10000 + 15000), one by user (2000)
    expect(res.body.rows).toHaveLength(2);
    const userRow = res.body.rows.find((r: { user: { id: string } }) => r.user.id === user.user.id);
    const saRow = res.body.rows.find((r: { user: { id: string } }) => r.user.id === sa.user.id);
    expect(userRow).toMatchObject({ transactionCount: 1, total: "2000.00" });
    expect(saRow).toMatchObject({ transactionCount: 2, total: "25000.00" });
  });

  it("requires authentication", async () => {
    const res = await request(app).get(`${route}/date-wise`);
    expect(res.status).toBe(401);
  });

  it("explicit ungranted projectId is refused", async () => {
    const { user, projectB } = await seed();
    const res = await request(app)
      .get(`${route}/project-wise`)
      .query({ projectId: projectB.id })
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(403);
  });
});
