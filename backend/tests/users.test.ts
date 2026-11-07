import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import {
  app,
  createUser,
  DEFAULT_PASSWORD,
  resetDb,
  saContext,
  uniqueEmail,
  userContext,
} from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const route = "/api/v1/users";

async function createUserViaApi(
  token: string,
  payload: Record<string, unknown>,
) {
  return request(app).post(route).set("Authorization", `Bearer ${token}`).send(payload);
}

describe("POST /users", () => {
  it("creates a user (hashed password, normalized email, default role USER)", async () => {
    const sa = await saContext();
    const email = uniqueEmail("created").toUpperCase();

    const res = await createUserViaApi(sa.accessToken, {
      name: "New Staff",
      email,
      password: "Str0ngPass!",
      role: "USER",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "New Staff", email: email.toLowerCase(), role: "USER", isActive: true });
    expect(res.body).not.toHaveProperty("passwordHash");

    const row = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(row).toBeTruthy();
    expect(row!.passwordHash.startsWith("$2")).toBe(true);
    expect(await bcrypt.compare("Str0ngPass!", row!.passwordHash)).toBe(true);
  });

  it("rejects duplicate email with 409", async () => {
    const sa = await saContext();
    const email = uniqueEmail("dup");
    await createUser({ email });

    const res = await createUserViaApi(sa.accessToken, {
      name: "Dup",
      email,
      password: "Str0ngPass!",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("validates payload (bad role, weak payload shape)", async () => {
    const sa = await saContext();
    const badRole = await createUserViaApi(sa.accessToken, {
      name: "X",
      email: uniqueEmail("badrole"),
      password: "Str0ngPass!",
      role: "GOD",
    });
    expect(badRole.status).toBe(400);

    const missing = await createUserViaApi(sa.accessToken, { name: "X" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("is super-admin only (401 unauthenticated, 403 regular user)", async () => {
    const unauth = await request(app).post(route).send({ name: "X", email: uniqueEmail(), password: "Str0ngPass!" });
    expect(unauth.status).toBe(401);

    const user = await userContext();
    const forbidden = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ name: "X", email: uniqueEmail(), password: "Str0ngPass!" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  it("writes audit + record history for the creation", async () => {
    const sa = await saContext();
    const res = await createUserViaApi(sa.accessToken, {
      name: "Audited",
      email: uniqueEmail("aud"),
      password: "Str0ngPass!",
    });
    const audit = await prisma.auditLog.findFirst({ where: { action: "USER_CREATED" } });
    expect(audit?.entityId).toBe(res.body.id);

    const history = await prisma.recordHistory.findFirst({
      where: { entityType: "User", entityId: res.body.id },
    });
    expect(history?.action).toBe("CREATED");
  });
});

describe("GET /users", () => {
  it("lists users with pagination meta", async () => {
    const sa = await saContext();
    for (let i = 0; i < 5; i++) await createUser({ name: `Staff 0${i}` });

    const res = await request(app)
      .get(route)
      .query({ page: 2, pageSize: 3 })
      .set("Authorization", `Bearer ${sa.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toMatchObject({ page: 2, pageSize: 3, total: 6 });
    expect(res.body.data[0]).not.toHaveProperty("passwordHash");
  });

  it("searches by name and email (case-insensitive)", async () => {
    const sa = await saContext();
    await createUser({ name: "Rahim Uddin", email: uniqueEmail("rahim") });
    await createUser({ name: "Karim", email: `karim.${uniqueEmail("x")}` });

    const byName = await request(app)
      .get(route)
      .query({ search: "rahim" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].name).toBe("Rahim Uddin");

    const byEmail = await request(app)
      .get(route)
      .query({ search: "KARIM" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0].name).toBe("Karim");
  });

  it("filters by role and isActive", async () => {
    const sa = await saContext();
    await createUser({ role: "USER", isActive: true });
    await createUser({ role: "USER", isActive: false });
    await createUser({ role: "SUPER_ADMIN" });

    const activeOnly = await request(app)
      .get(route)
      .query({ isActive: "false" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(activeOnly.body.data).toHaveLength(1);
    expect(activeOnly.body.data[0].isActive).toBe(false);

    const admins = await request(app)
      .get(route)
      .query({ role: "SUPER_ADMIN" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(admins.body.data).toHaveLength(2); // saContext admin + the one created above
    expect(admins.body.data.every((u: { role: string }) => u.role === "SUPER_ADMIN")).toBe(true);
  });

  it("is super-admin only", async () => {
    const unauth = await request(app).get(route);
    expect(unauth.status).toBe(401);
    const user = await userContext();
    const forbidden = await request(app).get(route).set("Authorization", `Bearer ${user.accessToken}`);
    expect(forbidden.status).toBe(403);
  });
});

describe("GET /users/:id", () => {
  it("returns a single user without the hash", async () => {
    const sa = await saContext();
    const target = await createUser({ name: "Target" });
    const res = await request(app).get(`${route}/${target.id}`).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(target.id);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("404s for unknown id", async () => {
    const sa = await saContext();
    const res = await request(app).get(`${route}/nonexistent`).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /users/:id", () => {
  it("updates name and role and records field history", async () => {
    const sa = await saContext();
    const target = await createUser({ name: "Before" });

    const res = await request(app)
      .patch(`${route}/${target.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "After", role: "SUPER_ADMIN" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "After", role: "SUPER_ADMIN" });

    const changes = await prisma.recordHistory.findMany({
      where: { entityType: "User", entityId: target.id, action: "UPDATED" },
    });
    const fields = changes.map((c) => c.field).sort();
    expect(fields).toEqual(["name", "role"]);
    const nameChange = changes.find((c) => c.field === "name");
    expect(nameChange?.oldValue).toBe("Before");
    expect(nameChange?.newValue).toBe("After");
  });

  it("rejects email change to an existing address (409)", async () => {
    const sa = await saContext();
    const other = await createUser();
    const target = await createUser();
    const res = await request(app)
      .patch(`${route}/${target.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ email: other.email });
    expect(res.status).toBe(409);
  });

  it("blocks self role change (lockout prevention)", async () => {
    const sa = await saContext();
    const res = await request(app)
      .patch(`${route}/${sa.user.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ role: "USER" });
    expect(res.status).toBe(400);
    expect((await prisma.user.findUnique({ where: { id: sa.user.id } }))!.role).toBe("SUPER_ADMIN");
  });

  it("is super-admin only", async () => {
    const target = await createUser();
    const user = await userContext();
    const res = await request(app)
      .patch(`${route}/${target.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /users/:id/status", () => {
  it("deactivates a user and kills their sessions", async () => {
    const sa = await saContext();
    const email = uniqueEmail("kill");
    const ctx = await userContext(email); // logs in -> refresh token stored
    const res = await request(app)
      .patch(`${route}/${ctx.user.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const tokens = await prisma.refreshToken.findMany({ where: { userId: ctx.user.id } });
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${ctx.accessToken}`);
    expect(me.status).toBe(401);

    const loginAgain = await request(app).post("/api/v1/auth/login").send({ email, password: DEFAULT_PASSWORD });
    expect(loginAgain.status).toBe(401);
  });

  it("blocks self-deactivation and deactivating the last active super admin", async () => {
    const sa = await saContext();
    const self = await request(app)
      .patch(`${route}/${sa.user.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(self.status).toBe(400);

    const secondAdmin = await createUser({ role: "SUPER_ADMIN" });
    const ok = await request(app)
      .patch(`${route}/${secondAdmin.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(ok.status).toBe(200);

    const lastAdmin = await request(app)
      .patch(`${route}/${sa.user.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(lastAdmin.status).toBe(400);
  });

  it("records a STATUS_CHANGED history row", async () => {
    const sa = await saContext();
    const target = await createUser();
    await request(app)
      .patch(`${route}/${target.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });

    const h = await prisma.recordHistory.findFirst({
      where: { entityType: "User", entityId: target.id, action: "STATUS_CHANGED" },
    });
    expect(h?.field).toBe("isActive");
    expect(h?.newValue).toBe("false");
  });
});

describe("PATCH /users/:id/password", () => {
  it("sets a new password and revokes existing sessions", async () => {
    const sa = await saContext();
    const email = uniqueEmail("pwreset");
    const ctx = await userContext(email);
    const oldToken = ctx.accessToken;

    const res = await request(app)
      .patch(`${route}/${ctx.user.id}/password`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ password: "BrandNew123!" });
    expect(res.status).toBe(200);

    const tokens = await prisma.refreshToken.findMany({ where: { userId: ctx.user.id } });
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);

    const oldSession = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${oldToken}`);
    expect(oldSession.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "BrandNew123!" });
    expect(newPasswordLogin.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: DEFAULT_PASSWORD });
    expect(oldPasswordLogin.status).toBe(401);
  });

  it("validates password presence", async () => {
    const sa = await saContext();
    const target = await createUser();
    const res = await request(app)
      .patch(`${route}/${target.id}/password`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("GET /users/dropdown", () => {
  it("returns only active users as id/name/email/role sorted by name", async () => {
    const sa = await saContext();
    await createUser({ name: "Zahid", isActive: false });
    await createUser({ name: "Alam" });
    await createUser({ name: "Babu", role: "SUPER_ADMIN" });

    const res = await request(app).get(`${route}/dropdown`).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { name: string }) => u.name)).toEqual(["Alam", "Babu", "Super Admin"]);
    expect(res.body.data.every((u: Record<string, unknown>) => !("passwordHash" in u))).toBe(true);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(["email", "id", "isActive", "name", "role"]);
  });

  it("is super-admin only", async () => {
    const user = await userContext();
    const res = await request(app).get(`${route}/dropdown`).set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(403);
  });
});
