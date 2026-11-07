import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BACKEND_ROOT, testDbUrl } from "./paths.js";

/**
 * Runs once per vitest invocation: recreate the shared test database and
 * apply all migrations so every suite starts from a known schema.
 */
export default function globalSetup() {
  const dbFile = testDbUrl().replace("file:", "");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbFile + suffix, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: testDbUrl() },
    stdio: "inherit",
  });
  console.log(`[test] fresh database at ${path.relative(BACKEND_ROOT, dbFile)}`);
}
