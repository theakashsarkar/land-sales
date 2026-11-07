import path from "node:path";
import { fileURLToPath } from "node:url";

export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Deterministic per-run test database location (overwritten by globalSetup). */
export function testDbUrl(): string {
  return `file:${path.join(BACKEND_ROOT, "prisma", "test.db")}`;
}
