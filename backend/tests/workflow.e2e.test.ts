import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, DEFAULT_PASSWORD, resetDb, uniqueEmail } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const api = "/api/v1";

/**
 * Full business lifecycle, exercising every module in one flow:
 * super admin bootstrap -> staff user -> project/category -> assignment ->
 * financial record -> payments -> receipt -> invoice -> dashboards ->
 * reports + exports -> void a payment -> verify balances recover.
 */
describe("end-to-end workflow", () => {
  it("runs the complete lifecycle", async () => {
    // 1. seed super admin via the seed script's own logic path (login with seeded creds)
    const saEmail = uniqueEmail("boss");
    await prisma.user.create({
      data: {
        name: "Boss",
        email: saEmail,
        passwordHash: await (await import("bcryptjs")).hash(DEFAULT_PASSWORD, 4),
        role: "SUPER_ADMIN",
      },
    });
    const saLogin = await request(app).post(`${api}/auth/login`).send({ email: saEmail, password: DEFAULT_PASSWORD });
    expect(saLogin.status).toBe(200);
    const sa = saLogin.body.accessToken as string;
    const saAuth = { Authorization: `Bearer ${sa}` };

    // 2. SA creates a staff user
    const staffEmail = uniqueEmail("staff");
    const createdUser = await request(app)
      .post(`${api}/users`)
      .set(saAuth)
      .send({ name: "Staff Member", email: staffEmail, password: DEFAULT_PASSWORD, role: "USER" });
    expect(createdUser.status).toBe(201);

    // 3. SA creates project + category
    const project = await request(app)
      .post(`${api}/projects`)
      .set(saAuth)
      .send({ name: "Green Valley Township", code: "GVT", location: "Purbachal" });
    expect(project.status).toBe(201);
    const category = await request(app)
      .post(`${api}/categories`)
      .set(saAuth)
      .send({ name: "Plot Sale" });
    expect(category.status).toBe(201);

    // 4. Before assignment, staff cannot create records for the project
    const staffLogin = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: staffEmail, password: DEFAULT_PASSWORD });
    expect(staffLogin.status).toBe(200);
    const staff = staffLogin.body.accessToken as string;
    const staffAuth = { Authorization: `Bearer ${staff}` };

    const denied = await request(app)
      .post(`${api}/financial-records`)
      .set(staffAuth)
      .send({
        title: "Sale",
        partyName: "Buyer",
        projectId: project.body.id,
        categoryId: category.body.id,
        totalAmount: "100000",
      });
    expect(denied.status).toBe(403);

    // 5. SA grants access
    const assign = await request(app)
      .post(`${api}/projects/${project.body.id}/users`)
      .set(saAuth)
      .send({ userIds: [createdUser.body.id] });
    expect(assign.status).toBe(200);

    // staff dropdown now shows the project
    const dropdown = await request(app).get(`${api}/projects/dropdown`).set(staffAuth);
    expect(dropdown.body.data.map((p: { id: string }) => p.id)).toContain(project.body.id);

    // 6. Staff creates a financial record — sequential code issued
    const record = await request(app)
      .post(`${api}/financial-records`)
      .set(staffAuth)
      .send({
        title: "Plot GV-A-014 sale",
        partyName: "Rahim Uddin",
        partyPhone: "+8801712345678",
        projectId: project.body.id,
        categoryId: category.body.id,
        totalAmount: "1250000.50",
      });
    expect(record.status).toBe(201);
    expect(record.body.code).toMatch(/^FIN-\d{4}-000001$/);
    const recordId = record.body.id as string;

    // 7. Two payments + one voided
    const pay1 = await request(app)
      .post(`${api}/financial-records/${recordId}/payments`)
      .set(staffAuth)
      .send({ amount: "500000", method: "BANK", reference: "BANK-001", paidAt: "2026-01-15" });
    expect(pay1.status).toBe(201);
    const pay2 = await request(app)
      .post(`${api}/financial-records/${recordId}/payments`)
      .set(staffAuth)
      .send({ amount: "250000", method: "CASH", reference: "CASH-002", paidAt: "2026-02-20" });
    expect(pay2.status).toBe(201);

    const dup = await request(app)
      .post(`${api}/financial-records/${recordId}/payments`)
      .set(staffAuth)
      .send({ amount: "500000", method: "BANK", reference: "BANK-001" });
    expect(dup.status).toBe(409);

    const detail = await request(app).get(`${api}/financial-records/${recordId}`).set(staffAuth);
    expect(detail.body.paidAmount).toBe("750000.00");
    expect(detail.body.remainingAmount).toBe("500000.50");

    // 8. Receipt for the first payment
    const receipt = await request(app)
      .post(`${api}/invoices/receipts`)
      .set(staffAuth)
      .send({ transactionId: pay1.body.transaction.id });
    expect(receipt.status).toBe(201);
    expect(receipt.body.number).toMatch(/^RCP-\d{4}-000001$/);

    // 9. Invoice for the next installment
    const invoice = await request(app)
      .post(`${api}/invoices`)
      .set(staffAuth)
      .send({
        financialRecordId: recordId,
        items: [{ description: "2nd installment demand", quantity: 1, unitPrice: "500000.50" }],
        dueDate: "2026-06-30",
      });
    expect(invoice.status).toBe(201);
    expect(invoice.body.total).toBe("500000.50");

    // 10. Dashboards (both roles)
    const saDash = await request(app).get(`${api}/dashboard`).set(saAuth);
    expect(saDash.body.financial.totalAmount).toBe("1250000.50");
    expect(saDash.body.financial.totalPaidAmount).toBe("750000.00");
    const staffDash = await request(app).get(`${api}/dashboard`).set(staffAuth);
    expect(staffDash.body.counts.users).toBeNull();

    // 11. Reports
    const dateWise = await request(app)
      .get(`${api}/reports/date-wise`)
      .query({ from: "2026-01-01", to: "2026-12-31" })
      .set(saAuth);
    expect(dateWise.body.rows).toHaveLength(2);

    // 12. Void the second payment — balance recovers, history preserved
    const voidRes = await request(app)
      .post(`${api}/transactions/${pay2.body.transaction.id}/void`)
      .set(saAuth)
      .send({ reason: "Customer returned cheque" });
    expect(voidRes.status).toBe(200);

    const afterVoid = await request(app).get(`${api}/financial-records/${recordId}`).set(saAuth);
    expect(afterVoid.body.paidAmount).toBe("500000.00");
    expect(afterVoid.body.remainingAmount).toBe("750000.50");

    const recordTxs = await request(app).get(`${api}/financial-records/${recordId}/transactions`).set(saAuth);
    expect(recordTxs.body.data).toHaveLength(2); // voided row still present
    const voidedRow = recordTxs.body.data.find((t: { id: string }) => t.id === pay2.body.transaction.id);
    expect(voidedRow.status).toBe("VOID");
    expect(voidedRow.voidReason).toBe("Customer returned cheque");

    // 13. Super admin edits the record total — old and new values recorded
    const update = await request(app)
      .patch(`${api}/financial-records/${recordId}`)
      .set(saAuth)
      .send({ totalAmount: "1300000" });
    expect(update.status).toBe(200);

    const history = await request(app).get(`${api}/financial-records/${recordId}/history`).set(saAuth);
    const amountChange = history.body.data.find((h: { field: string }) => h.field === "totalAmount");
    expect(amountChange).toMatchObject({ oldValue: "1250000.50", newValue: "1300000.00" });

    const afterUpdate = await request(app).get(`${api}/financial-records/${recordId}`).set(saAuth);
    expect(afterUpdate.body.remainingAmount).toBe("800000.00");

    // 14. SA deactivates the staff user — sessions die immediately
    const deactivate = await request(app)
      .patch(`${api}/users/${createdUser.body.id}/status`)
      .set(saAuth)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    const deadSession = await request(app).get(`${api}/auth/me`).set(staffAuth);
    expect(deadSession.status).toBe(401);
  });
});
