import crypto from "node:crypto";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import type { AuthUser } from "../src/types.js";

export const app = createApp();

export const randomHex = () => crypto.randomBytes(5).toString("hex");
export const uniqueEmail = (prefix = "user") => `${prefix}-${randomHex()}@test.local`;

export const DEFAULT_PASSWORD = "Password123!";

/** Wipe every table (child rows first). Suites call this in beforeEach. */
export async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.recordHistory.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.financialRecord.deleteMany();
  await prisma.projectUser.deleteMany();
  await prisma.category.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(overrides: Partial<{
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
}> = {}) {
  const password = overrides.password ?? DEFAULT_PASSWORD;
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? uniqueEmail(),
      passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
      role: overrides.role ?? "USER",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function login(email: string, password = DEFAULT_PASSWORD) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as { user: AuthUser; accessToken: string };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Super admin context: created user + logged-in session. */
export async function saContext(email = uniqueEmail("sa")) {
  const user = await createUser({ email, role: "SUPER_ADMIN", name: "Super Admin" });
  const session = await login(email);
  return { ...session, user };
}

/** Regular user context, optionally granted access to projects. */
export async function userContext(email = uniqueEmail("user"), projectIds: string[] = []) {
  const user = await createUser({ email, role: "USER", name: "Regular User" });
  const session = await login(email);
  for (const projectId of projectIds) {
    await prisma.projectUser.create({ data: { projectId, userId: user.id } });
  }
  return { ...session, user };
}

export async function makeProject(
  overrides: Partial<{ name: string; code: string; description: string; location: string; isActive: boolean }> = {},
) {
  return prisma.project.create({
    data: {
      name: overrides.name ?? `Project ${randomHex()}`,
      code: overrides.code ?? `P${randomHex().toUpperCase()}`,
      description: overrides.description,
      location: overrides.location,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function makeCategory(
  overrides: Partial<{ name: string; description: string; isActive: boolean }> = {},
) {
  return prisma.category.create({
    data: {
      name: overrides.name ?? `Category ${randomHex()}`,
      nameKey: (overrides.name ?? `Category ${randomHex()}`).toLowerCase(),
      description: overrides.description,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function makeFinancialRecord(
  overrides: Partial<{
    code: string;
    title: string;
    partyName: string;
    partyPhone: string;
    projectId: string;
    categoryId: string;
    totalAmount: Prisma.Decimal.Value;
    status: string;
    createdById: string;
    createdAt: Date;
  }> & { actorId?: string } = {},
) {
  const project = overrides.projectId ? null : await makeProject();
  const category = overrides.categoryId ? null : await makeCategory();
  return prisma.financialRecord.create({
    data: {
      code: overrides.code ?? `FTEST-${randomHex().toUpperCase()}`,
      title: overrides.title ?? "Test record",
      partyName: overrides.partyName ?? "Test Party",
      partyPhone: overrides.partyPhone ?? null,
      projectId: overrides.projectId ?? project!.id,
      categoryId: overrides.categoryId ?? category!.id,
      totalAmount: new Prisma.Decimal(overrides.totalAmount ?? "100000"),
      status: overrides.status ?? "ACTIVE",
      createdById: overrides.createdById ?? overrides.actorId ?? (await saContext()).user.id,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

/** Assert a serialized money string equals an expected amount (2dp). */
export const expectMoney = (actual: string | null | undefined, expected: Prisma.Decimal.Value) => {
  const expectedStr = new Prisma.Decimal(expected).toFixed(2);
  if (actual !== expectedStr) {
    throw new Error(`Expected money ${expectedStr}, got ${actual}`);
  }
};
