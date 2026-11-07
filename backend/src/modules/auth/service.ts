import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  signAccessToken,
} from "../../lib/tokens.js";
import {
  assertNotLocked,
  recordFailure,
  recordSuccess,
  __resetLoginThrottleForTests as resetLoginThrottle,
} from "../../lib/loginThrottle.js";
import type { AuthUser } from "../../types.js";

export const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

function authUserOf(user: { id: string; name: string; email: string; role: string }): AuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role as AuthUser["role"] };
}

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
  };
}

export function setRefreshCookie(res: { cookie: Function }, raw: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.cookie(REFRESH_COOKIE, raw, cookieOptions(env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) as any);
}

export function clearRefreshCookie(res: { clearCookie: Function }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH } as any);
}

export async function login(
  input: { email: string; password: string },
  meta: RequestMeta,
): Promise<{ user: ReturnType<typeof publicUser>; accessToken: string; refreshToken: string }> {
  assertNotLocked(input.email, meta.ip);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : bcrypt.compare(input.password, "$2a$12$notarealhashnotarealhashnotarealhashnotarealha").catch(() => false);

  if (!user || !passwordOk) {
    recordFailure(input.email, meta.ip);
    await writeAudit(prisma, {
      userId: user?.id ?? null,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id,
      metadata: { email: input.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    await writeAudit(prisma, {
      userId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      metadata: { email: input.email, reason: "inactive" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.unauthorized("Invalid email or password");
  }

  recordSuccess(input.email, meta.ip);
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiry() },
  });
  const accessToken = signAccessToken(authUserOf(user));
  await writeAudit(prisma, {
    userId: user.id,
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { user: publicUser(user), accessToken, refreshToken };
}

export async function refresh(
  rawToken: string | undefined,
): Promise<{ user: ReturnType<typeof publicUser>; accessToken: string; refreshToken: string }> {
  if (!rawToken) throw AppError.unauthorized("Missing refresh token");

  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: true },
  });
  if (!row) throw AppError.unauthorized("Invalid refresh token");

  if (row.revokedAt) {
    // Reuse of a rotated/revoked token — revoke the whole family.
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(prisma, {
      userId: row.userId,
      action: "AUTH_REFRESH_REUSE_DETECTED",
      entityType: "User",
      entityId: row.userId,
    });
    throw AppError.unauthorized("Refresh token reuse detected — session revoked");
  }

  if (row.expiresAt < new Date()) throw AppError.unauthorized("Refresh token expired");
  if (!row.user.isActive) throw AppError.unauthorized("Account is inactive");

  const newRefreshToken = generateRefreshToken();
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: { userId: row.userId, tokenHash: hashRefreshToken(newRefreshToken), expiresAt: refreshExpiry() },
    }),
  ]);

  return {
    user: publicUser(row.user),
    accessToken: signAccessToken(authUserOf(row.user)),
    refreshToken: newRefreshToken,
  };
}

export async function logout(rawToken: string | undefined, meta: RequestMeta) {
  if (rawToken) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(rawToken) } });
    if (row && !row.revokedAt) {
      await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      await writeAudit(prisma, {
        userId: row.userId,
        action: "AUTH_LOGOUT",
        entityType: "User",
        entityId: row.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
  }
  return { ok: true };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw AppError.unauthorized();
  return publicUser(user);
}

/** @internal test hook */
export function __resetLoginThrottleForTests() {
  resetLoginThrottle();
}
