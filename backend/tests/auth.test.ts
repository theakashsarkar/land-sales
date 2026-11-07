import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app, createUser, DEFAULT_PASSWORD, resetDb, uniqueEmail, userContext } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authModule: any = await import("../src/modules/auth/service.js");
const resetLoginThrottle = authModule.__resetLoginThrottleForTests as (() => void) | undefined;

beforeEach(async () => {
  await resetDb();
  resetLoginThrottle?.();
});

afterEach(async () => {
  await prisma.$disconnect();
});

const loginRoute = "/api/v1/auth/login";
const refreshRoute = "/api/v1/auth/refresh";
const logoutRoute = "/api/v1/auth/logout";
const meRoute = "/api/v1/auth/me";

function refreshCookieOf(res: request.Response): string {
  const cookies = res.headers["set-cookie"];
  const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
  expect(cookie, "expected a refresh cookie").toBeTruthy();
  return cookie as unknown as string;
}

describe("POST /auth/login", () => {
  it("returns user + accessToken and sets an httpOnly refresh cookie", async () => {
    const email = uniqueEmail("login");
    await createUser({ email, name: "Login Tester", role: "SUPER_ADMIN" });

    const res = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "Login Tester", email, role: "SUPER_ADMIN" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken.split(".")).toHaveLength(3); // JWT

    const cookie = refreshCookieOf(res);
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it("stores only a bcrypt hash of the password", async () => {
    const email = uniqueEmail("hash");
    const user = await createUser({ email, password: "Sup3rSecret!" });
    expect(user.passwordHash).not.toBe("Sup3rSecret!");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
    expect(await bcrypt.compare("Sup3rSecret!", user.passwordHash)).toBe(true);
  });

  it("rejects a wrong password with 401 and identical message as unknown email", async () => {
    const email = uniqueEmail("wrongpw");
    await createUser({ email });

    const wrongPw = await request(app).post(loginRoute).send({ email, password: "nope" });
    const unknownEmail = await request(app).post(loginRoute).send({ email: "nobody@test.local", password: "nope" });

    expect(wrongPw.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPw.body.error.code).toBe("UNAUTHORIZED");
    expect(unknownEmail.body.error.message).toBe(wrongPw.body.error.message);
  });

  it("rejects deactivated users even with valid credentials", async () => {
    const email = uniqueEmail("inactive");
    await createUser({ email, isActive: false });

    const res = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("validates the payload", async () => {
    const res = await request(app).post(loginRoute).send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rate-limits repeated failed attempts per email", async () => {
    const email = uniqueEmail("throttle");
    await createUser({ email });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post(loginRoute).send({ email, password: "bad" });
      expect(res.status).toBe(401);
    }
    const locked = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("RATE_LIMITED");

    // A different account is unaffected.
    const otherEmail = uniqueEmail("unthrottled");
    await createUser({ email: otherEmail });
    const other = await request(app).post(loginRoute).send({ email: otherEmail, password: DEFAULT_PASSWORD });
    expect(other.status).toBe(200);
  });

  it("writes audit log entries for successful and failed logins", async () => {
    const email = uniqueEmail("audit");
    await createUser({ email });

    await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    await request(app).post(loginRoute).send({ email, password: "bad" });

    const actions = (await prisma.auditLog.findMany({ where: { action: { startsWith: "AUTH_" } } })).map(
      (a) => a.action,
    );
    expect(actions).toContain("AUTH_LOGIN");
    expect(actions).toContain("AUTH_LOGIN_FAILED");
  });
});

describe("GET /auth/me", () => {
  it("returns the session user for a valid bearer token", async () => {
    const { user, accessToken } = await userContext(uniqueEmail("me"));
    const res = await request(app).get(meRoute).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, role: user.role });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("rejects missing, malformed and expired-signature tokens", async () => {
    const noToken = await request(app).get(meRoute);
    expect(noToken.status).toBe(401);

    const garbage = await request(app).get(meRoute).set("Authorization", "Bearer not.a.jwt");
    expect(garbage.status).toBe(401);
    expect(garbage.body.error.code).toBe("UNAUTHORIZED");

    const signedElsewhere = await request(app)
      .get(meRoute)
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalidsig");
    expect(signedElsewhere.status).toBe(401);
  });

  it("rejects tokens belonging to a deactivated user", async () => {
    const { user, accessToken } = await userContext(uniqueEmail("deact"));
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await request(app).get(meRoute).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });

  it("never trusts the role inside the token — role comes from the database", async () => {
    const { user, accessToken } = await userContext(uniqueEmail("rolechange"));
    // Token was minted while role=USER; promote in DB afterwards.
    await prisma.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN" } });
    const res = await request(app).get(meRoute).set("Authorization", `Bearer ${accessToken}`);
    expect(res.body.role).toBe("SUPER_ADMIN");
  });
});

describe("POST /auth/refresh", () => {
  it("issues a new access token and rotates the refresh cookie", async () => {
    const email = uniqueEmail("refresh");
    await createUser({ email });
    const loginRes = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    const cookie = refreshCookieOf(loginRes);

    const res = await request(app).post(refreshRoute).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    const newCookie = refreshCookieOf(res);
    expect(newCookie).not.toBe(cookie);
  });

  it("rejects reuse of an already-rotated token and revokes the whole family", async () => {
    const email = uniqueEmail("reuse");
    await createUser({ email });
    const loginRes = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    const oldCookie = refreshCookieOf(loginRes);

    const first = await request(app).post(refreshRoute).set("Cookie", oldCookie);
    expect(first.status).toBe(200);
    const newCookie = refreshCookieOf(first);

    // Replay the OLD token — reuse detection must kill the session.
    const replay = await request(app).post(refreshRoute).set("Cookie", oldCookie);
    expect(replay.status).toBe(401);

    // Even the freshly-rotated token is now dead.
    const afterRevoke = await request(app).post(refreshRoute).set("Cookie", newCookie);
    expect(afterRevoke.status).toBe(401);
  });

  it("rejects missing/unknown/expired refresh tokens", async () => {
    const none = await request(app).post(refreshRoute);
    expect(none.status).toBe(401);

    const unknown = await request(app).post(refreshRoute).set("Cookie", "refreshToken=deadbeef");
    expect(unknown.status).toBe(401);

    const email = uniqueEmail("expired");
    const user = await createUser({ email });
    const { hashRefreshToken } = await import("../src/lib/tokens.js");
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken("expired-token"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const expired = await request(app).post(refreshRoute).set("Cookie", "refreshToken=expired-token");
    expect(expired.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the refresh token and clears the cookie", async () => {
    const email = uniqueEmail("logout");
    await createUser({ email });
    const loginRes = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    const cookie = refreshCookieOf(loginRes);

    const res = await request(app).post(logoutRoute).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const cleared = refreshCookieOf(res);
    expect(cleared).toMatch(/refreshToken=;/);

    const after = await request(app).post(refreshRoute).set("Cookie", cookie);
    expect(after.status).toBe(401);
  });

  it("writes an AUTH_LOGOUT audit entry", async () => {
    const email = uniqueEmail("logoutaudit");
    await createUser({ email });
    const loginRes = await request(app).post(loginRoute).send({ email, password: DEFAULT_PASSWORD });
    const cookie = refreshCookieOf(loginRes);
    await request(app).post(logoutRoute).set("Cookie", cookie);

    const found = await prisma.auditLog.findFirst({ where: { action: "AUTH_LOGOUT" } });
    expect(found).toBeTruthy();
  });
});
