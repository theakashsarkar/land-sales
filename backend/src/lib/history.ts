import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

const display = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  // Prisma.Decimal (money/quantity): canonical 2dp string so trailing
  // zeros are never lost between old/new comparisons.
  if (typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function") {
    return (v as { toFixed: (d: number) => string }).toFixed(2);
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Lifecycle event row (no field diff), e.g. CREATED / VOIDED / CANCELLED. */
export function recordEvent(
  db: Db,
  args: {
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string | null;
    field?: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
) {
  return db.recordHistory.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      field: args.field ?? null,
      oldValue: args.oldValue === undefined ? null : display(args.oldValue),
      newValue: args.newValue === undefined ? null : display(args.newValue),
      actorId: args.actorId ?? null,
    },
  });
}

/** Diff scalar fields between the previous and updated row values. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const oldValue = display(before[field]);
    const newValue = display(after[field]);
    if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
  }
  return changes;
}

/** Persist one history row per changed field. */
export function recordChanges(
  db: Db,
  args: {
    entityType: string;
    entityId: string;
    action: string;
    changes: FieldChange[];
    actorId?: string | null;
  },
) {
  if (args.changes.length === 0) return Promise.resolve();
  return db.recordHistory.createMany({
    data: args.changes.map((c) => ({
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      actorId: args.actorId ?? null,
    })),
  });
}
