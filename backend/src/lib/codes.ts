import type { Prisma } from "@prisma/client";

const NUMBER_PAD = 6;

/**
 * Generate the next sequential business code for a model, e.g.
 * nextCode(tx, "financialRecord", "code", `FIN-${year}-`) -> "FIN-2026-000001".
 *
 * Fixed-width zero padding keeps lexicographic ordering equal to numeric
 * ordering, so ordering by the code descending yields the current max.
 * Callers must run inside a transaction and retry on unique-constraint
 * conflicts (see withCodeRetry).
 */

type CodeModels = {
  financialRecord: { code: string };
  invoice: { number: string };
};

export async function nextCode<K extends keyof CodeModels>(
  tx: Prisma.TransactionClient,
  model: K,
  prefix: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (tx as any)[model] as {
    findFirst(args: { where: Record<string, unknown>; orderBy: Record<string, string> }): Promise<CodeModels[K] | null>;
  };
  const field = model === "invoice" ? "number" : "code";
  const last = await delegate.findFirst({
    where: { [field]: { startsWith: prefix } },
    orderBy: { [field]: "desc" },
  });
  const lastNumber = last ? parseInt(String((last as Record<string, unknown>)[field]).slice(prefix.length), 10) : 0;
  const next = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;
  return `${prefix}${String(next).padStart(NUMBER_PAD, "0")}`;
}

/** Run `fn` retrying on unique-constraint violations caused by concurrent code generation. */
export async function withCodeRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isUniqueViolation =
        typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
      if (!isUniqueViolation) throw err;
    }
  }
  throw lastErr;
}
