import { testDbUrl } from "./paths.js";

// Set environment BEFORE any test file imports the app (env.ts reads
// process.env at import time; dotenv will not override these).
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDbUrl();
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-0123456789abcdef0123456789abcdef";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-0123456789abcdef0123456789abcdef";
process.env.BCRYPT_ROUNDS ||= "4";
