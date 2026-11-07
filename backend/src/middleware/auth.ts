import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { AuthUser, Role } from "../types.js";

/**
 * Verifies the Bearer access token and loads a fresh, active user from the
 * database. The role is always taken from the DB — token claims are never
 * trusted for authorization decisions.
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw AppError.unauthorized();

  const payload = verifyAccessToken(token);
  if (!payload) throw AppError.unauthorized("Invalid or expired token");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw AppError.unauthorized("Account is inactive");

  // Tokens issued before the last password change are no longer valid —
  // a password change immediately invalidates every outstanding session.
  if (
    user.passwordChangedAt &&
    payload.iat !== undefined &&
    payload.iat * 1000 < user.passwordChangedAt.getTime()
  ) {
    throw AppError.unauthorized("Session expired due to a password change");
  }

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role as AuthUser["role"] };
  next();
});

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };

export const requireSuperAdmin = requireRole("SUPER_ADMIN");
