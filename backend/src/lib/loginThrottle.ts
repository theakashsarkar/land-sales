import { env } from "../config/env.js";
import { AppError } from "./errors.js";

interface Attempt {
  count: number;
  lockedUntil: number;
}

// In-memory per-process throttle keyed by `${email}|${ip}`. Good enough for
// a single-instance deployment; swap for Redis when scaling horizontally.
const attempts = new Map<string, Attempt>();

function key(email: string, ip: string | null | undefined) {
  return `${email.toLowerCase()}|${ip ?? "unknown"}`;
}

export function assertNotLocked(email: string, ip: string | null | undefined) {
  const entry = attempts.get(key(email, ip));
  if (!entry) return;
  if (entry.lockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    throw AppError.rateLimited(
      `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      { retryAfterSeconds },
    );
  }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) attempts.delete(key(email, ip));
}

export function recordFailure(email: string, ip: string | null | undefined) {
  const k = key(email, ip);
  const entry = attempts.get(k) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= env.LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + env.LOGIN_LOCK_MINUTES * 60 * 1000;
    entry.count = 0;
  }
  attempts.set(k, entry);
}

export function recordSuccess(email: string, ip: string | null | undefined) {
  attempts.delete(key(email, ip));
}

/** @internal test hook */
export function __resetLoginThrottleForTests() {
  attempts.clear();
}
