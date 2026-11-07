import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
import type { AuthUser } from "../types.js";

/**
 * Project ids the user may access. SUPER_ADMIN -> null meaning "all".
 * Regular users only get ids explicitly granted via project_user.
 */
export async function accessibleProjectIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === "SUPER_ADMIN") return null;
  const grants = await prisma.projectUser.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return grants.map((g) => g.projectId);
}

/**
 * Throws 403 unless the user may access the given project. Never trust
 * client-provided ids: access is always resolved from the session user.
 */
export async function assertProjectAccess(user: AuthUser, projectId: string): Promise<void> {
  if (user.role === "SUPER_ADMIN") return;
  const grant = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { projectId: true },
  });
  if (!grant) {
    throw AppError.forbidden("You do not have access to this project");
  }
}

/** Filter clause restricting queries to the user's accessible projects. */
export async function projectScopeFilter(
  user: AuthUser,
): Promise<{ projectId: { in: string[] } } | Record<string, never>> {
  const ids = await accessibleProjectIds(user);
  if (ids === null) return {};
  return { projectId: { in: ids } };
}
