import type { AuthUser } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after validating the bearer token. */
      user?: AuthUser;
    }
  }
}

export {};
