import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;
export type MoneyValue = Prisma.Decimal.Value;

/** Create a Decimal from any supported value. */
export const D = (value: MoneyValue): Money => new Prisma.Decimal(value);

/**
 * Normalize an amount to exactly 2 decimal places, half-up rounding.
 * All stored money values go through this before being persisted.
 */
export function toMoney(value: MoneyValue): Money {
  const d = new Prisma.Decimal(value);
  if (!d.isFinite()) throw new Error(`Invalid money value: ${value}`);
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Validate + normalize an incoming monetary amount from an API request. */
export function parseMoney(value: unknown): Money {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Prisma.Decimal)) {
    throw new TypeError("Amount must be a number or numeric string");
  }
  const d = new Prisma.Decimal(value as MoneyValue);
  if (!d.isFinite()) throw new TypeError(`Invalid money value: ${value}`);
  if (d.isNegative()) throw new TypeError("Amount must not be negative");
  return toMoney(d);
}

/**
 * Serialize money for JSON responses as a fixed 2-decimal string so no
 * precision is ever lost client-side (JS numbers cannot represent values
 * like 99999999999999.98 exactly).
 */
export function serializeMoney(value: MoneyValue | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value).toFixed(2);
}

export function sumMoney(values: MoneyValue[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(v), new Prisma.Decimal(0));
}

export type { Prisma };
