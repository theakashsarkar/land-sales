import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthUser } from "../types.js";

export function signAccessToken(user: AuthUser): string {
  const options: jwt.SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] };
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    env.JWT_ACCESS_SECRET,
    options,
  );
}

export interface AccessPayload {
  sub: string;
  role: string;
  /** issued-at epoch seconds */
  iat?: number;
}

/** Returns the payload or null for any invalid/expired/garbage token. */
export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, role: payload.role, iat: payload.iat };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** Refresh tokens are stored hashed — a DB leak never yields usable sessions. */
export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
