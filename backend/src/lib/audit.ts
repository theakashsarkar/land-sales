import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export interface AuditInput {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/** Append a row to the immutable system audit log. */
export function writeAudit(db: Db, input: AuditInput) {
  return db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata === undefined ? null : JSON.stringify(input.metadata),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
